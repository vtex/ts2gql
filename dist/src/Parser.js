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
var MethodParamsParser = /** @class */ (function () {
    function MethodParamsParser() {
        this.tokenizer = new Tokenizer_1.MethodParamsTokenizer();
        this.tokens = [];
        this.args = new Map();
    }
    MethodParamsParser.prototype.parse = function (stringToParse) {
        this.tokens = this.tokenizer.tokenize(stringToParse);
        return Array.from(this._parseArgs().values());
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
        if (this.args.get(nameToken.value)) {
            throw new ParsingFailedException("Repeated param name '" + nameToken.value + "'.");
        }
        this.args.set(nameToken.value, {
            name: nameToken.value,
            kind: types.GQLDefinitionKind.DIRECTIVE_INPUT_VALUE_DEFINITION,
            value: {
                kind: types.GQLTypeKind.VALUE,
                value: valueToken.value,
            },
        });
        return start + 3;
    };
    return MethodParamsParser;
}());
exports.MethodParamsParser = MethodParamsParser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBaUM7QUFDakMseUNBQWtGO0FBRWxGO0lBQXFDLDBDQUFLO0lBQTFDOztJQUE0QyxDQUFDO0lBQUQsNkJBQUM7QUFBRCxDQUFDLEFBQTdDLENBQXFDLEtBQUssR0FBRztBQUU3QztJQUtJO1FBQ0ksSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGlDQUFxQixFQUFFLENBQUM7UUFDN0MsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDakIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBeUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsa0NBQUssR0FBTCxVQUFNLGFBQW9CO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDckQsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCx1Q0FBVSxHQUFWO1FBQ0ksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUsscUJBQVMsQ0FBQyxvQkFBb0IsRUFBRTtZQUN4RSxNQUFNLElBQUksc0JBQXNCLENBQUMsNkNBQTZDLENBQUMsQ0FBQztTQUNuRjtRQUNELElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNmLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUsscUJBQVMsQ0FBQyxrQkFBa0IsRUFBRTtZQUM5RCxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ1osSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLG1CQUFtQjtvQkFDMUQsTUFBTSxJQUFJLHNCQUFzQixDQUFDLDJEQUEyRCxDQUFDLENBQUM7Z0JBQ2xHLE1BQU0sRUFBRSxDQUFDO2FBQ1o7WUFDRCxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUNuQztRQUVELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNyQixDQUFDO0lBRUQsc0NBQVMsR0FBVCxVQUFVLEtBQVk7UUFDbEIsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxJQUFNLHVCQUF1QixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFDLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxxQkFBUyxDQUFDLGNBQWM7ZUFDNUMsdUJBQXVCLENBQUMsSUFBSSxLQUFLLHFCQUFTLENBQUMsOEJBQThCO2VBQ3pFLFVBQVUsQ0FBQyxJQUFJLEtBQUsscUJBQVMsQ0FBQyxlQUFlLEVBQUU7WUFDOUMsTUFBTSxJQUFJLHNCQUFzQixDQUFDLCtEQUM3QixTQUFTLENBQUMsSUFBSSxVQUFLLFNBQVMsQ0FBQyxLQUFLLHdCQUNsQyx1QkFBdUIsQ0FBQyxJQUFJLFVBQUssdUJBQXVCLENBQUMsS0FBSyx3QkFDOUQsVUFBVSxDQUFDLElBQUksVUFBSyxVQUFVLENBQUMsS0FBTyxDQUFDLENBQUM7U0FDL0M7UUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNoQyxNQUFNLElBQUksc0JBQXNCLENBQUMsMEJBQXdCLFNBQVMsQ0FBQyxLQUFLLE9BQUksQ0FBQyxDQUFDO1NBQ2pGO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRTtZQUMzQixJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUs7WUFDckIsSUFBSSxFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxnQ0FBZ0M7WUFDOUQsS0FBSyxFQUFFO2dCQUNILElBQUksRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUs7Z0JBQzdCLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSzthQUMxQjtTQUNKLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBQ0wseUJBQUM7QUFBRCxDQUFDLEFBNURELElBNERDO0FBNURZLGdEQUFrQiJ9