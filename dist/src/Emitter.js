"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var types = require("./types");
var util = require("./util");
// tslint:disable-next-line
// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
var Emitter = /** @class */ (function () {
    function Emitter(collector) {
        var _this = this;
        this.emissionMap = new Map();
        this.emissionQueue = [];
        this._emitInputValue = function (node) {
            return _this._name(node.name) + ": " + _this._emitExpression(node.value);
        };
        this._emitExpression = function (node) {
            if (node.kind === types.GQLTypeKind.VALUE) {
                return "" + node.value;
            }
            var required = node.nullable ? '' : '!';
            var emitted = '';
            if (util.isReferenceType(node)) {
                var referenceName = _this._name(node.target);
                _this._emitTopLevelNode(_this.typeMap.get(referenceName), referenceName);
                emitted = referenceName;
            }
            else if (node.kind === types.GQLTypeKind.LIST_TYPE) {
                emitted = "[" + _this._emitExpression(node.wrapped) + "]";
            }
            else if (node.kind === types.GQLTypeKind.STRING_TYPE) {
                emitted = 'String';
            }
            else if (node.kind === types.GQLTypeKind.FLOAT_TYPE) {
                emitted = 'Float';
            }
            else if (node.kind === types.GQLTypeKind.INT_TYPE) {
                emitted = 'Int';
            }
            else if (node.kind === types.GQLTypeKind.BOOLEAN_TYPE) {
                emitted = 'Boolean';
            }
            else if (node.kind === types.GQLTypeKind.ID_TYPE) {
                emitted = 'ID';
            }
            return emitted + required;
        };
        // Utility
        this._name = function (name) {
            return name.replace(/\W/g, '_');
        };
        this.typeMap = collector.types;
        if (!collector.root) {
            throw new Error("Empty schema definition.");
        }
        this.root = collector.root;
    }
    Emitter.prototype.emitAll = function (stream) {
        var _this = this;
        stream.write('\n');
        var query = this.typeMap.get(this.root.query);
        var mutation = this.root.mutation ? this.typeMap.get(this.root.mutation) : undefined;
        if (query) {
            var queryRootName = this._name(this.root.query);
            this._emitTopLevelNode(query, queryRootName);
        }
        if (mutation) {
            var mutationRootName = this._name(this.root.mutation);
            this._emitTopLevelNode(mutation, mutationRootName);
        }
        this.emissionQueue.forEach(function (emissionElem) { return stream.write(_this.emissionMap.get(emissionElem) + "\n"); });
        stream.write(this._emitSchema() + "\n");
    };
    Emitter.prototype._emitTopLevelNode = function (node, name) {
        if (this.emissionMap.has(name)) {
            return;
        }
        if (node.kind !== types.GQLDefinitionKind.DEFINITION_ALIAS) {
            this.emissionMap.set(name, '');
        }
        var description = this._emitDescription(node.description);
        var content;
        switch (node.kind) {
            case types.GQLDefinitionKind.OBJECT_DEFINITION:
                content = this._emitObject(node, name);
                break;
            case types.GQLDefinitionKind.INTERFACE_DEFINITION:
                content = this._emitInterface(node, name);
                break;
            case types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION:
                content = this._emitInputObject(node, name);
                break;
            case types.GQLDefinitionKind.ENUM_DEFINITION:
                content = this._emitEnum(node, name);
                break;
            case types.GQLDefinitionKind.UNION_DEFINITION:
                content = this._emitUnion(node, name);
                break;
            case types.GQLDefinitionKind.SCALAR_DEFINITION:
                content = this._emitScalarDefinition(node, name);
                break;
            case types.GQLDefinitionKind.DEFINITION_ALIAS:
                var aliased = this.typeMap.get(node.target);
                content = this._emitTopLevelNode(aliased, name);
                return;
            default:
                throw new Error("Unsupported top level node '" + name + "'.");
        }
        this.emissionQueue.push(name);
        this.emissionMap.set(name, description + content);
    };
    Emitter.prototype._emitSchema = function () {
        var properties = "query: " + this._name(this.root.query)
            + (this.root.mutation ? "\nmutation: " + this._name(this.root.mutation) : '');
        return "schema {\n" + this._indent(properties) + "\n}";
    };
    // Specialized emitters
    Emitter.prototype._emitDescription = function (desc) {
        return desc ? "\"\"\"\n" + desc + "\n\"\"\"\n" : '';
    };
    Emitter.prototype._emitObject = function (node, name) {
        var emittedImplements = this._emitImplementations(node);
        if (emittedImplements) {
            emittedImplements = ' ' + emittedImplements;
        }
        return "type " + this._name(name) + emittedImplements + " {\n" + this._emitFields(node.fields) + "\n}";
    };
    Emitter.prototype._emitImplementations = function (node) {
        var _this = this;
        var implemented = node.implements.filter(function (reference) {
            var referenced = _this.typeMap.get(reference.target);
            if (!referenced) {
                return false;
            }
            _this._emitTopLevelNode(referenced, _this._name(reference.target));
            return referenced.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION;
        }).map(function (reference) { return _this._name(reference.target); });
        if (implemented.length === 0) {
            return '';
        }
        return "implements " + implemented.join(' & ');
    };
    Emitter.prototype._emitInterface = function (node, name) {
        return "interface " + this._name(name) + " {\n" + this._emitFields(node.fields) + "\n}";
    };
    Emitter.prototype._emitFields = function (fields) {
        var _this = this;
        var emitted = fields.map(function (field) { return _this._emitField(field); });
        return emitted.join('\n');
    };
    Emitter.prototype._emitField = function (field) {
        var description = this._emitDescription(field.description);
        var argumentList = this._emitArguments(field.arguments);
        var directives = this._emitFieldDirectives(field.directives);
        if (directives) {
            directives = ' ' + directives;
        }
        return this._indent(description
            + ("" + this._name(field.name) + argumentList + ": " + this._emitExpression(field.type) + directives));
    };
    Emitter.prototype._emitArguments = function (args) {
        return args && args.length > 0 ? "(" + args.map(this._emitInputValue).join(', ') + ")" : '';
    };
    Emitter.prototype._emitFieldDirectives = function (directives) {
        var _this = this;
        return directives ? directives.map(function (directive) {
            var emittedArgs = _this._emitArguments(directive.args);
            return "@" + directive.name + emittedArgs;
        }).join(' ') : '';
    };
    Emitter.prototype._emitInputObject = function (node, name) {
        return "input " + this._name(name) + " {\n" + this._emitFields(node.fields) + "\n}";
    };
    Emitter.prototype._emitEnum = function (node, name) {
        return "enum " + this._name(name) + " {\n" + this._emitEnumFields(node.fields) + "\n}";
    };
    Emitter.prototype._emitEnumFields = function (fields) {
        var _this = this;
        return fields.map(function (field) { return _this._indent(_this._emitDescription(field.description) + field.name); }).join('\n');
    };
    Emitter.prototype._emitUnion = function (node, name) {
        var _this = this;
        var nodeNames = node.members.map(function (member) { return _this._emitExpression(member); });
        return "union " + this._name(name) + " = " + nodeNames.join(' | ');
    };
    Emitter.prototype._emitScalarDefinition = function (node, name) {
        return node.builtIn ? '' : "scalar " + this._name(name);
    };
    Emitter.prototype._indent = function (content) {
        if (!_.isArray(content))
            content = content.split('\n');
        return content.map(function (s) { return "  " + s; }).join('\n');
    };
    return Emitter;
}());
exports.default = Emitter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFHL0IsMkJBQTJCO0FBQzNCLG1JQUFtSTtBQUNuSTtJQUtFLGlCQUFZLFNBQXVCO1FBQW5DLGlCQU1DO1FBUk8sZ0JBQVcsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN0RCxrQkFBYSxHQUFzQixFQUFFLENBQUM7UUE2SDlDLG9CQUFlLEdBQUcsVUFBQyxJQUFtRTtZQUNwRixPQUFVLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFLLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBRyxDQUFDO1FBQ3pFLENBQUMsQ0FBQTtRQThCRCxvQkFBZSxHQUFHLFVBQUMsSUFBbUM7WUFDcEQsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO2dCQUN6QyxPQUFPLEtBQUcsSUFBSSxDQUFDLEtBQU8sQ0FBQzthQUN4QjtZQUNELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQzFDLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNqQixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlCLElBQU0sYUFBYSxHQUFHLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM5QyxLQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFFLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQ3hFLE9BQU8sR0FBRyxhQUFhLENBQUM7YUFDekI7aUJB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