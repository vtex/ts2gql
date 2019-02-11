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
var types = require("./types");
var Tokenizer_1 = require("./Tokenizer");
var ParsingFailedException = /** @class */ (function (_super) {
    __extends(ParsingFailedException, _super);
    function ParsingFailedException() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ParsingFailedException;
}(Error));
exports.ParsingFailedException = ParsingFailedException;
var MethodParamsParser = /** @class */ (function () {
    function MethodParamsParser() {
        this.tokenizer = new Tokenizer_1.MethodParamsTokenizer();
        this.tokens = [];
        this.args = {};
    }
    MethodParamsParser.prototype.parse = function (stringToParse) {
        this.tokens = this.tokenizer.tokenize(stringToParse);
        return {
            type: types.NodeType.METHOD_PARAMS,
            args: this._parseArgs(),
        };
    };
    MethodParamsParser.prototype._parseArgs = function () {
        if (!this.tokens || this.tokens[0].type !== Tokenizer_1.TokenType.PARAMETER_LIST_BEGIN) {
            throw new ParsingFailedException("Token list created without beginning token.");
        }
        var argIdx = 1;
        while (this.tokens[argIdx].type !== Tokenizer_1.TokenType.PARAMETER_LIST_END) {
            if (argIdx > 1) {
                if (this.tokens[argIdx].type !== Tokenizer_1.TokenType.PARAMETER_SEPARATOR)
                    throw new ParsingFailedException("Expected separators between parameters in parameter list.");
                argIdx++;
            }
            argIdx = this._parseArg(argIdx);
        }
        return this.args;
    };
    MethodParamsParser.prototype._parseArg = function (start) {
        var nameToken = this.tokens[start];
        var nameValueSeparatorToken = this.tokens[start + 1];
        var valueToken = this.tokens[start + 2];
        if (nameToken.type !== Tokenizer_1.TokenType.PARAMETER_NAME
            || nameValueSeparatorToken.type !== Tokenizer_1.TokenType.PARAMETER_NAME_VALUE_SEPARATOR
            || valueToken.type !== Tokenizer_1.TokenType.PARAMETER_VALUE) {
            throw new ParsingFailedException("Invalid token sequence for parameter list:\n            \n" + nameToken.type + ": " + nameToken.value + "\n            \n" + nameValueSeparatorToken.type + ": " + nameValueSeparatorToken.value + "\n            \n" + valueToken.type + ": " + valueToken.value);
        }
        if (this.args[nameToken.value]) {
            throw new ParsingFailedException("Repeated param name " + nameToken.value + ".");
        }
        this.args[nameToken.value] = {
            type: types.NodeType.VALUE,
            value: valueToken.value,
        };
        return start + 3;
    };
    return MethodParamsParser;
}());
exports.MethodParamsParser = MethodParamsParser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSwrQkFBaUM7QUFDakMseUNBQWtGO0FBY2xGO0lBQTRDLDBDQUFLO0lBQWpEOztJQUFtRCxDQUFDO0lBQUQsNkJBQUM7QUFBRCxDQUFDLEFBQXBELENBQTRDLEtBQUssR0FBRztBQUF2Qyx3REFBc0I7QUFFbkM7SUFLSTtRQUNJLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxpQ0FBcUIsRUFBRSxDQUFDO1FBQzdDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ25CLENBQUM7SUFFRCxrQ0FBSyxHQUFMLFVBQU0sYUFBb0I7UUFDdEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNyRCxNQUFNLENBQUM7WUFDSCxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxhQUFhO1lBQ2xDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFO1NBQzFCLENBQUM7SUFDTixDQUFDO0lBRUQsdUNBQVUsR0FBVjtRQUNJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztZQUN6RSxNQUFNLElBQUksc0JBQXNCLENBQUMsNkNBQTZDLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ0QsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDL0QsRUFBRSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUsscUJBQVMsQ0FBQyxtQkFBbUIsQ0FBQztvQkFDM0QsTUFBTSxJQUFJLHNCQUFzQixDQUFDLDJEQUEyRCxDQUFDLENBQUM7Z0JBQ2xHLE1BQU0sRUFBRSxDQUFDO1lBQ2IsQ0FBQztZQUNELE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNyQixDQUFDO0lBRUQsc0NBQVMsR0FBVCxVQUFVLEtBQVk7UUFDbEIsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxJQUFNLHVCQUF1QixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUsscUJBQVMsQ0FBQyxjQUFjO2VBQzVDLHVCQUF1QixDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLDhCQUE4QjtlQUN6RSxVQUFVLENBQUMsSUFBSSxLQUFLLHFCQUFTLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztZQUMvQyxNQUFNLElBQUksc0JBQXNCLENBQUMsK0RBQzdCLFNBQVMsQ0FBQyxJQUFJLFVBQUssU0FBUyxDQUFDLEtBQUssd0JBQ2xDLHVCQUF1QixDQUFDLElBQUksVUFBSyx1QkFBdUIsQ0FBQyxLQUFLLHdCQUM5RCxVQUFVLENBQUMsSUFBSSxVQUFLLFVBQVUsQ0FBQyxLQUFPLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sSUFBSSxzQkFBc0IsQ0FBQyx5QkFBdUIsU0FBUyxDQUFDLEtBQUssTUFBRyxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHO1lBQ3pCLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUs7WUFDMUIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLO1NBQzFCLENBQUM7UUFFRixNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBQ0wseUJBQUM7QUFBRCxDQUFDLEFBM0RELElBMkRDO0FBM0RZLGdEQUFrQiJ9