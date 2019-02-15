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
var TranspilationError = /** @class */ (function (_super) {
    __extends(TranspilationError, _super);
    function TranspilationError(node, msg) {
        var _this = _super.call(this, msg) || this;
        _this.fileAndLine = function () {
            return "(" + _this.fileName + ":" + _this.lineNumber + ")";
        };
        var src = node.getSourceFile();
        _this.fileName = fileOnly(src.fileName);
        _this.lineNumber = src.getLineAndCharacterOfPosition(node.getStart(src, false)).line + 1;
        return _this;
    }
    return TranspilationError;
}(Error));
exports.TranspilationError = TranspilationError;
var InterfaceError = /** @class */ (function (_super) {
    __extends(InterfaceError, _super);
    function InterfaceError(node, msg) {
        var _this = _super.call(this, node, msg) || this;
        _this.message = "At interface '" + node.name.getText() + "'" + _this.fileAndLine() + "\n" + _this.message;
        return _this;
    }
    return InterfaceError;
}(TranspilationError));
exports.InterfaceError = InterfaceError;
var PropertyError = /** @class */ (function (_super) {
    __extends(PropertyError, _super);
    function PropertyError(node, msg) {
        var _this = _super.call(this, node, msg) || this;
        _this.message = "At property '" + node.name.getText() + "'" + _this.fileAndLine() + "\n" + _this.message;
        return _this;
    }
    return PropertyError;
}(TranspilationError));
exports.PropertyError = PropertyError;
var InputValueError = /** @class */ (function (_super) {
    __extends(InputValueError, _super);
    function InputValueError(node, msg) {
        var _this = _super.call(this, node, msg) || this;
        _this.message = "At parameter '" + node.name.getText() + "'" + _this.fileAndLine() + "\n" + _this.message;
        return _this;
    }
    return InputValueError;
}(TranspilationError));
exports.InputValueError = InputValueError;
var TypeAliasError = /** @class */ (function (_super) {
    __extends(TypeAliasError, _super);
    function TypeAliasError(node, msg) {
        var _this = _super.call(this, node, msg) || this;
        _this.message = "At type '" + node.name.getText() + "'" + _this.fileAndLine() + "\n" + _this.message;
        return _this;
    }
    return TypeAliasError;
}(TranspilationError));
exports.TypeAliasError = TypeAliasError;
var EnumError = /** @class */ (function (_super) {
    __extends(EnumError, _super);
    function EnumError(node, msg) {
        var _this = _super.call(this, node, msg) || this;
        _this.message = "At enum '" + node.name.getText() + "'" + _this.fileAndLine() + "\n" + _this.message;
        return _this;
    }
    return EnumError;
}(TranspilationError));
exports.EnumError = EnumError;
var fileOnly = function (path) {
    var splitted = path.split('/');
    return splitted[splitted.length - 1];
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXhjZXB0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FeGNlcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUVBO0lBQXdDLHNDQUFLO0lBR3pDLDRCQUFZLElBQW9CLEVBQUUsR0FBVTtRQUE1QyxZQUNJLGtCQUFNLEdBQUcsQ0FBQyxTQUliO1FBRVMsaUJBQVcsR0FBRztZQUNwQixPQUFPLE1BQUksS0FBSSxDQUFDLFFBQVEsU0FBSSxLQUFJLENBQUMsVUFBVSxNQUFHLENBQUM7UUFDbkQsQ0FBQyxDQUFBO1FBUEcsSUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ2pDLEtBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QyxLQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7O0lBQzVGLENBQUM7SUFLTCx5QkFBQztBQUFELENBQUMsQUFiRCxDQUF3QyxLQUFLLEdBYTVDO0FBYlksZ0RBQWtCO0FBZS9CO0lBQW9DLGtDQUFrQjtJQUNsRCx3QkFBWSxJQUFvQyxFQUFFLEdBQVU7UUFBNUQsWUFDSSxrQkFBTSxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBRW5CO1FBREcsS0FBSSxDQUFDLE9BQU8sR0FBRyxtQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBSSxLQUFJLENBQUMsV0FBVyxFQUFFLFVBQUssS0FBSSxDQUFDLE9BQVMsQ0FBQzs7SUFDakcsQ0FBQztJQUNMLHFCQUFDO0FBQUQsQ0FBQyxBQUxELENBQW9DLGtCQUFrQixHQUtyRDtBQUxZLHdDQUFjO0FBTzNCO0lBQW1DLGlDQUFrQjtJQUNqRCx1QkFBWSxJQUEyQixFQUFFLEdBQVU7UUFBbkQsWUFDSSxrQkFBTSxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBRW5CO1FBREcsS0FBSSxDQUFDLE9BQU8sR0FBRyxrQkFBZ0IsSUFBSSxDQUFDLElBQUssQ0FBQyxPQUFPLEVBQUUsU0FBSSxLQUFJLENBQUMsV0FBVyxFQUFFLFVBQUssS0FBSSxDQUFDLE9BQVMsQ0FBQzs7SUFDakcsQ0FBQztJQUNMLG9CQUFDO0FBQUQsQ0FBQyxBQUxELENBQW1DLGtCQUFrQixHQUtwRDtBQUxZLHNDQUFhO0FBTzFCO0lBQXFDLG1DQUFrQjtJQUNuRCx5QkFBWSxJQUFvQyxFQUFFLEdBQVU7UUFBNUQsWUFDSSxrQkFBTSxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBRW5CO1FBREcsS0FBSSxDQUFDLE9BQU8sR0FBRyxtQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBSSxLQUFJLENBQUMsV0FBVyxFQUFFLFVBQUssS0FBSSxDQUFDLE9BQVMsQ0FBQzs7SUFDakcsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FBQyxBQUxELENBQXFDLGtCQUFrQixHQUt0RDtBQUxZLDBDQUFlO0FBTzVCO0lBQW9DLGtDQUFrQjtJQUNsRCx3QkFBWSxJQUFvQyxFQUFFLEdBQVU7UUFBNUQsWUFDSSxrQkFBTSxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBRW5CO1FBREcsS0FBSSxDQUFDLE9BQU8sR0FBRyxjQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQUksS0FBSSxDQUFDLFdBQVcsRUFBRSxVQUFLLEtBQUksQ0FBQyxPQUFTLENBQUM7O0lBQzVGLENBQUM7SUFDTCxxQkFBQztBQUFELENBQUMsQUFMRCxDQUFvQyxrQkFBa0IsR0FLckQ7QUFMWSx3Q0FBYztBQU8zQjtJQUErQiw2QkFBa0I7SUFDN0MsbUJBQVksSUFBK0IsRUFBRSxHQUFVO1FBQXZELFlBQ0ksa0JBQU0sSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUVuQjtRQURHLEtBQUksQ0FBQyxPQUFPLEdBQUcsY0FBWSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFJLEtBQUksQ0FBQyxXQUFXLEVBQUUsVUFBSyxLQUFJLENBQUMsT0FBUyxDQUFDOztJQUM1RixDQUFDO0lBQ0wsZ0JBQUM7QUFBRCxDQUFDLEFBTEQsQ0FBK0Isa0JBQWtCLEdBS2hEO0FBTFksOEJBQVM7QUFPdEIsSUFBTSxRQUFRLEdBQUcsVUFBQyxJQUFXO0lBQ3pCLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakMsT0FBTyxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUMifQ==