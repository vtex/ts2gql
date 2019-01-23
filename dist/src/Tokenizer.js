"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var TokenType;
(function (TokenType) {
    TokenType["PARAMETER_LIST_BEGIN"] = "PARAMETER_LIST_BEGIN";
    TokenType["PARAMETER_NAME"] = "PARAMETER_NAME";
    TokenType["PARAMETER_NAME_VALUE_SEPARATOR"] = "PARAMETER_NAME_VALUE_SEPARATOR";
    TokenType["PARAMETER_VALUE"] = "PARAMETER_VALUE";
    TokenType["PARAMETER_SEPARATOR"] = "PARAMETER_SEPARATOR";
    TokenType["PARAMETER_LIST_END"] = "PARAMETER_LIST_END";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
var MethodParamsToken = /** @class */ (function () {
    function MethodParamsToken(type, value) {
        this.type = type;
        this.value = value;
    }
    return MethodParamsToken;
}());
exports.MethodParamsToken = MethodParamsToken;
var MethodParamsTokenizerException = /** @class */ (function (_super) {
    __extends(MethodParamsTokenizerException, _super);
    function MethodParamsTokenizerException() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return MethodParamsTokenizerException;
}(Error));
var MethodParamsTokenizer = /** @class */ (function () {
    function MethodParamsTokenizer() {
        this.tokens = [];
        this.raw = '';
    }
    MethodParamsTokenizer.prototype.tokenize = function (content) {
        delete this.tokens;
        this.tokens = [];
        this.raw = content;
        this.begin();
        return this.tokens;
    };
    MethodParamsTokenizer.prototype.begin = function () {
        var idx = 0;
        if (this.raw[idx] !== '(') {
            throw new MethodParamsTokenizerException("Expected '(' at the beginning of parameter list declaration.");
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_LIST_BEGIN, this.raw[idx]));
        idx = this._ignore(/\s/, idx + 1);
        while (idx < this.raw.length && this.raw[idx] !== ')') {
            if (this.tokens.length > 1) {
                if (this.raw[idx] !== ',') {
                    var lastToken = this.tokens[this.tokens.length - 1];
                    throw new MethodParamsTokenizerException("Expected ',' after " + lastToken.value + " token.");
                }
                this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_SEPARATOR, ','));
                idx = this._ignore(/\s/, idx + 1);
            }
            idx = this.parameter(idx);
        }
        if (idx >= this.raw.length) {
            throw new MethodParamsTokenizerException("Expected ')' at the end of parameter list declaration.");
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_LIST_END, this.raw[idx]));
        var excessStart = idx + 1;
        var excess = this.raw.slice(excessStart);
        if (excess.match(/[^\s]/g)) {
            throw new MethodParamsTokenizerException("Unexpected out of bound expression '" + excess + "'.");
        }
    };
    MethodParamsTokenizer.prototype.parameter = function (idx) {
        idx = this.parameterName(idx);
        idx = this._ignore(/\s/, idx);
        if (this.raw[idx] !== ':') {
            var lastName = this.tokens[this.tokens.length - 1].value;
            throw new MethodParamsTokenizerException("Expected ':' after parameter '" + lastName + "'.");
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_NAME_VALUE_SEPARATOR, this.raw[idx]));
        idx = this._ignore(/\s/, idx + 1);
        try {
            idx = this.parameterValue(idx);
        }
        catch (e) {
            var paramName = this.tokens[this.tokens.length - 2].value;
            e.message = e.message + " in parameter '" + paramName + "'.";
            throw e;
        }
        return this._ignore(/\s/, idx);
    };
    MethodParamsTokenizer.prototype.parameterName = function (idx) {
        var nameEnd = this._ignore(/\w/, idx);
        var name = this.raw.slice(idx, nameEnd);
        if (!name) {
            throw new MethodParamsTokenizerException("Expected parameter name, found '" + this.raw[idx] + "'");
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_NAME, name));
        return nameEnd;
    };
    MethodParamsTokenizer.prototype.parameterValue = function (idx) {
        if (this.raw[idx].match(/'|"/)) {
            return this.stringLiteral(idx);
        }
        var valueEnd = this._until(/\s|,|\)/, idx);
        var value = this.raw.slice(idx, valueEnd);
        if (!this._checkPrimitiveValue(value)) {
            var msg = value.length === 0 ? "Missing value"
                : "Invalid value '" + value + "'. Expected number, boolean, string literal or name'";
            throw new MethodParamsTokenizerException(msg);
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, value));
        return valueEnd;
    };
    MethodParamsTokenizer.prototype.stringLiteral = function (idx) {
        var delimiter = this.raw[idx];
        var literalEndRegex = new RegExp("(?:[^\\\\](?:\\\\{2})*)" + delimiter);
        var result = literalEndRegex.exec(this.raw.slice(idx));
        if (result === null) {
            throw new MethodParamsTokenizerException("Mismatched string literal delimiter '" + delimiter + "'");
        }
        var matchBegin = idx + result.index;
        var matchLength = result[0].length;
        if (this.raw.slice(idx, matchBegin + matchLength).match(/\n/)) {
            throw new MethodParamsTokenizerException("Invalid multiline string literal");
        }
        var literalEnd = matchBegin + matchLength;
        var literal = this.raw.slice(idx, literalEnd);
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, literal));
        return literalEnd;
    };
    MethodParamsTokenizer.prototype._checkPrimitiveValue = function (value) {
        if (value.match(/[A-Z_]/i)) {
            return this._checkNameValue(value);
        }
        return this._checkNumberValue(value);
    };
    MethodParamsTokenizer.prototype._checkNameValue = function (value) {
        return !value.match(/^\d/) && !value.match(/\W/);
    };
    MethodParamsTokenizer.prototype._checkNumberValue = function (value) {
        return !isNaN(Number(value).valueOf());
    };
    MethodParamsTokenizer.prototype._ignore = function (ignore, start) {
        var iterator = start;
        while (iterator < this.raw.length && this.raw[iterator].match(ignore)) {
            iterator++;
        }
        return iterator;
    };
    MethodParamsTokenizer.prototype._until = function (ignore, start) {
        var iterator = start;
        while (iterator < this.raw.length && !this.raw[iterator].match(ignore)) {
            iterator++;
        }
        return iterator;
    };
    return MethodParamsTokenizer;
}());
exports.MethodParamsTokenizer = MethodParamsTokenizer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVG9rZW5pemVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1Rva2VuaXplci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSxJQUFZLFNBT1g7QUFQRCxXQUFZLFNBQVM7SUFDakIsMERBQTZDLENBQUE7SUFDN0MsOENBQWlDLENBQUE7SUFDakMsOEVBQWlFLENBQUE7SUFDakUsZ0RBQW1DLENBQUE7SUFDbkMsd0RBQTJDLENBQUE7SUFDM0Msc0RBQXlDLENBQUE7QUFDN0MsQ0FBQyxFQVBXLFNBQVMsR0FBVCxpQkFBUyxLQUFULGlCQUFTLFFBT3BCO0FBRUQ7SUFJSSwyQkFBWSxJQUFjLEVBQUUsS0FBWTtRQUNwQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUN2QixDQUFDO0lBQ0wsd0JBQUM7QUFBRCxDQUFDLEFBUkQsSUFRQztBQVJZLDhDQUFpQjtBQVU5QjtJQUE2QyxrREFBSztJQUFsRDs7SUFBb0QsQ0FBQztJQUFELHFDQUFDO0FBQUQsQ0FBQyxBQUFyRCxDQUE2QyxLQUFLLEdBQUc7QUFFckQ7SUFJSTtRQUNJLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ2xCLENBQUM7SUFFRCx3Q0FBUSxHQUFSLFVBQVMsT0FBYztRQUNuQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFFakIsSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7UUFDbkIsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRWIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVELHFDQUFLLEdBQUw7UUFDSSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDWixFQUFF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