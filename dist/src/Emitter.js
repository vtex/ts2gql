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
        this.typeMap = collector.resolved;
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
                if (aliased.name === name) {
                    throw new Error("Can not emit alias with same name of original type.");
                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFHL0IsMkJBQTJCO0FBQzNCLG1JQUFtSTtBQUNuSTtJQUtFLGlCQUFZLFNBQXVCO1FBQW5DLGlCQU1DO1FBUk8sZ0JBQVcsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN0RCxrQkFBYSxHQUFzQixFQUFFLENBQUM7UUFnSTlDLG9CQUFlLEdBQUcsVUFBQyxJQUFtRTtZQUNwRixPQUFVLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFLLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBRyxDQUFDO1FBQ3pFLENBQUMsQ0FBQTtRQW9DRCxvQkFBZSxHQUFHLFVBQUMsSUFBbUM7WUFDcEQsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO2dCQUN6QyxPQUFPLEtBQUcsSUFBSSxDQUFDLEtBQU8sQ0FBQzthQUN4QjtZQUNELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQzFDLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNqQixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlCLE9BQU8sR0FBRyxLQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3JDO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRTtnQkFDcEQsT0FBTyxHQUFHLE1BQUksS0FBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQUcsQ0FBQzth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