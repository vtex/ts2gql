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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBaUM7QUFDakMseUNBQWtGO0FBY2xGO0lBQTRDLDBDQUFLO0lBQWpEOztJQUFtRCxDQUFDO0lBQUQsNkJBQUM7QUFBRCxDQUFDLEFBQXBELENBQTRDLEtBQUssR0FBRztBQUF2Qyx3REFBc0I7QUFFbkM7SUFLSTtRQUNJLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxpQ0FBcUIsRUFBRSxDQUFDO1FBQzdDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ25CLENBQUM7SUFFRCxrQ0FBSyxHQUFMLFVBQU0sYUFBb0I7UUFDdEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNyRCxPQUFPO1lBQ0gsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsYUFBYTtZQUNsQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtTQUMxQixDQUFDO0lBQ04sQ0FBQztJQUVELHVDQUFVLEdBQVY7UUFDSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLG9CQUFvQixFQUFFO1lBQ3hFLE1BQU0sSUFBSSxzQkFBc0IsQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO1NBQ25GO1FBQ0QsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLGtCQUFrQixFQUFFO1lBQzlELElBQUksTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDWixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLHFCQUFTLENBQUMsbUJBQW1CO29CQUMxRCxNQUFNLElBQUksc0JBQXNCLENBQUMsMkRBQTJELENBQUMsQ0FBQztnQkFDbEcsTUFBTSxFQUFFLENBQUM7YUFDWjtZQUNELE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ25DO1FBRUQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3JCLENBQUM7SUFFRCxzQ0FBUyxHQUFULFVBQVUsS0FBWTtRQUNsQixJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JDLElBQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkQsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDMUMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLHFCQUFTLENBQUMsY0FBYztlQUM1Qyx1QkFBdUIsQ0FBQyxJQUFJLEtBQUsscUJBQVMsQ0FBQyw4QkFBOEI7ZUFDekUsVUFBVSxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLGVBQWUsRUFBRTtZQUM5QyxNQUFNLElBQUksc0JBQXNCLENBQUMsK0RBQzdCLFNBQVMsQ0FBQyxJQUFJLFVBQUssU0FBUyxDQUFDLEtBQUssd0JBQ2xDLHVCQUF1QixDQUFDLElBQUksVUFBSyx1QkFBdUIsQ0FBQyxLQUFLLHdCQUM5RCxVQUFVLENBQUMsSUFBSSxVQUFLLFVBQVUsQ0FBQyxLQUFPLENBQUMsQ0FBQztTQUMvQztRQUVELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDNUIsTUFBTSxJQUFJLHNCQUFzQixDQUFDLHlCQUF1QixTQUFTLENBQUMsS0FBSyxNQUFHLENBQUMsQ0FBQztTQUMvRTtRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHO1lBQ3pCLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUs7WUFDMUIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLO1NBQzFCLENBQUM7UUFFRixPQUFPLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUNMLHlCQUFDO0FBQUQsQ0FBQyxBQTNERCxJQTJEQztBQTNEWSxnREFBa0IifQ==