"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
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
                : "Invalid value '" + value + "'. Expected number, boolean, string literal or name";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVG9rZW5pemVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1Rva2VuaXplci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFZLFNBT1g7QUFQRCxXQUFZLFNBQVM7SUFDakIsMERBQTZDLENBQUE7SUFDN0MsOENBQWlDLENBQUE7SUFDakMsOEVBQWlFLENBQUE7SUFDakUsZ0RBQW1DLENBQUE7SUFDbkMsd0RBQTJDLENBQUE7SUFDM0Msc0RBQXlDLENBQUE7QUFDN0MsQ0FBQyxFQVBXLFNBQVMsR0FBVCxpQkFBUyxLQUFULGlCQUFTLFFBT3BCO0FBRUQ7SUFJSSwyQkFBWSxJQUFjLEVBQUUsS0FBWTtRQUNwQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUN2QixDQUFDO0lBQ0wsd0JBQUM7QUFBRCxDQUFDLEFBUkQsSUFRQztBQVJZLDhDQUFpQjtBQVU5QjtJQUE2QyxrREFBSztJQUFsRDs7SUFBb0QsQ0FBQztJQUFELHFDQUFDO0FBQUQsQ0FBQyxBQUFyRCxDQUE2QyxLQUFLLEdBQUc7QUFFckQ7SUFJSTtRQUNJLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ2xCLENBQUM7SUFFRCx3Q0FBUSxHQUFSLFVBQVMsT0FBYztRQUNuQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFFakIsSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7UUFDbkIsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRWIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxxQ0FBSyxHQUFMO1FBQ0ksSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ1osSUFBSyxJ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