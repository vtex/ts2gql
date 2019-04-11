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
                emitted = _this._emitReference(node);
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
        var nodeNames = node.members.map(function (member) { return _this._emitReference(member); });
        return "union " + this._name(name) + " = " + nodeNames.join(' | ');
    };
    Emitter.prototype._emitScalarDefinition = function (node, name) {
        return node.builtIn ? '' : "scalar " + this._name(name);
    };
    Emitter.prototype._emitReference = function (node) {
        var referenceName = this._name(node.target);
        this._emitTopLevelNode(this.typeMap.get(referenceName), referenceName);
        return referenceName;
    };
    Emitter.prototype._indent = function (content) {
        if (!_.isArray(content))
            content = content.split('\n');
        return content.map(function (s) { return "  " + s; }).join('\n');
    };
    return Emitter;
}());
exports.default = Emitter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFHL0IsMkJBQTJCO0FBQzNCLG1JQUFtSTtBQUNuSTtJQUtFLGlCQUFZLFNBQXVCO1FBQW5DLGlCQU1DO1FBUk8sZ0JBQVcsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN0RCxrQkFBYSxHQUFzQixFQUFFLENBQUM7UUE2SDlDLG9CQUFlLEdBQUcsVUFBQyxJQUFtRTtZQUNwRixPQUFVLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFLLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBRyxDQUFDO1FBQ3pFLENBQUMsQ0FBQTtRQW9DRCxvQkFBZSxHQUFHLFVBQUMsSUFBbUM7WUFDcEQsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO2dCQUN6QyxPQUFPLEtBQUcsSUFBSSxDQUFDLEtBQU8sQ0FBQzthQUN4QjtZQUNELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQzFDLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNqQixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlCLE9BQU8sR0FBRyxLQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3JDO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRTtnQkFDcEQsT0FBTyxHQUFHLE1BQUksS0FBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQUcsQ0FBQzth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