"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var Types = require("./types");
// tslint:disable-next-line
// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
var Emitter = /** @class */ (function () {
    function Emitter(types) {
        var _this = this;
        this.types = types;
        this.renames = {};
        this._emitExpression = function (node) {
            if (!node) {
                return '';
            }
            else if (node.type === Types.NodeType.VALUE) {
                return "" + node.value;
            }
            else if (node.type === Types.NodeType.NOT_NULL) {
                return _this._emitExpression(node.node) + "!";
            }
            else if (node.type === Types.NodeType.STRING) {
                return 'String'; // TODO: ID annotation
            }
            else if (node.type === Types.NodeType.NUMBER) {
                return 'Float'; // TODO: Int/Float annotation
            }
            else if (node.type === Types.NodeType.BOOLEAN) {
                return 'Boolean';
            }
            else if (node.type === Types.NodeType.REFERENCE) {
                return _this._name(node.target);
            }
            else if (node.type === Types.NodeType.ARRAY) {
                return "[" + node.elements.map(_this._emitExpression).join(' | ') + "]";
            }
            else if (node.type === Types.NodeType.LITERAL_OBJECT || node.type === Types.NodeType.INTERFACE) {
                return _(_this._collectMembers(node))
                    .map(function (member) {
                    return _this._name(member.name) + ": " + _this._emitExpression(member.signature);
                })
                    .join(', ');
            }
            else if (node.type === Types.NodeType.UNION) {
                var nonNullTypes = node.types.filter(function (_a) {
                    var type = _a.type;
                    return type !== Types.NodeType.NULL && type !== Types.NodeType.UNDEFINED;
                });
                // If there is any non null type in the union, remove the non-null property of each object of union
                if (nonNullTypes.length !== node.types.length) {
                    nonNullTypes = nonNullTypes.map(function (nonNullNode) {
                        return (nonNullNode.type === Types.NodeType.NOT_NULL ? nonNullNode.node : node);
                    });
                }
                if (nonNullTypes.length !== 1) {
                    throw new Error("There's no support for union with non-null and non-undefined types.");
                }
                return _this._emitExpression(nonNullTypes[0]);
            }
            else {
                throw new Error("Can't serialize " + node.type + " as an expression");
            }
        };
        this._collectMembers = function (node) {
            var members = [];
            if (node.type === Types.NodeType.LITERAL_OBJECT) {
                members = node.members;
            }
            else {
                var seenProps = new Set();
                var interfaceNode = void 0;
                interfaceNode = node;
                // loop through this interface and any super-interfaces
                while (interfaceNode) {
                    try {
                        for (var _a = __values(interfaceNode.members), _b = _a.next(); !_b.done; _b = _a.next()) {
                            var member = _b.value;
                            if (seenProps.has(member.name))
                                continue;
                            seenProps.add(member.name);
                            members.push(member);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    if (interfaceNode.inherits.length > 1) {
                        throw new Error("No support for multiple inheritence: " + JSON.stringify(interfaceNode.inherits));
                    }
                    else if (interfaceNode.inherits.length === 1) {
                        var supertype = _this.types[interfaceNode.inherits[0]];
                        if (supertype.type !== Types.NodeType.INTERFACE) {
                            throw new Error("Expected supertype to be an interface node: " + supertype);
                        }
                        interfaceNode = supertype;
                    }
                    else {
                        interfaceNode = null;
                    }
                }
            }
            try {
                for (var members_1 = __values(members), members_1_1 = members_1.next(); !members_1_1.done; members_1_1 = members_1.next()) {
                    var member = members_1_1.value;
                    if (member.type !== Types.NodeType.PROPERTY) {
                        throw new Error("Expected members to be properties; got " + member.type);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (members_1_1 && !members_1_1.done && (_d = members_1.return)) _d.call(members_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return members;
            var e_1, _c, e_2, _d;
        };
        // Utility
        this._name = function (name) {
            name = _this.renames[name] || name;
            return name.replace(/\W/g, '_');
        };
        this.types = _.omitBy(types, function (node, name) { return _this._preprocessNode(node, name); });
    }
    Emitter.prototype.emitAll = function (stream) {
        var _this = this;
        stream.write('\n');
        _.each(this.types, function (node, name) { return _this.emitTopLevelNode(node, name, stream); });
    };
    Emitter.prototype.emitTopLevelNode = function (node, name, stream) {
        var content;
        if (node.type === Types.NodeType.ALIAS) {
            content = this._emitAlias(node, name);
        }
        else if (node.type === Types.NodeType.INTERFACE) {
            content = this._emitInterface(node, name);
        }
        else if (node.type === Types.NodeType.ENUM) {
            content = this._emitEnum(node, name);
        }
        else {
            throw new Error("Don't know how to emit " + node.type + " as a top level node");
        }
        stream.write(content + "\n\n");
    };
    // Preprocessing
    Emitter.prototype._preprocessNode = function (node, name) {
        var specialTags = ['ID', 'Int', 'Float'];
        if (node.type === Types.NodeType.ALIAS && node.target.type === Types.NodeType.REFERENCE) {
            var referencedNode = this.types[node.target.target];
            if (this._isPrimitive(referencedNode) || referencedNode.type === Types.NodeType.ENUM) {
                this.renames[name] = node.target.target;
                return true;
            }
        }
        else if (node.type === Types.NodeType.ALIAS) {
            try {
                for (var specialTags_1 = __values(specialTags), specialTags_1_1 = specialTags_1.next(); !specialTags_1_1.done; specialTags_1_1 = specialTags_1.next()) {
                    var tag = specialTags_1_1.value;
                    if (this._hasDocTag(node, tag)) {
                        this.renames[name] = tag;
                        return true;
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (specialTags_1_1 && !specialTags_1_1.done && (_a = specialTags_1.return)) _a.call(specialTags_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
        return false;
        var e_3, _a;
    };
    // Nodes
    Emitter.prototype._emitAlias = function (node, name) {
        if (this._isPrimitive(node.target)
            || (node.target.type === Types.NodeType.NOT_NULL && this._isPrimitive(node.target.node))) {
            return "scalar " + this._name(name);
        }
        else if (node.target.type === Types.NodeType.REFERENCE || (node.target.type === Types.NodeType.NOT_NULL
            && node.target.node.type === Types.NodeType.REFERENCE)) {
            var target = node.target.type === Types.NodeType.REFERENCE
                ? node.target : node.target.node;
            return "union " + this._name(name) + " = " + this._emitReference(target);
        }
        else if (node.target.type === 'union') {
            return this._emitUnion(node.target, name);
        }
        else {
            throw new Error("Can't serialize " + JSON.stringify(node.target) + " as an alias");
        }
    };
    Emitter.prototype._emitReference = function (node) {
        return this._name(node.target);
    };
    Emitter.prototype._emitUnion = function (node, name) {
        var _this = this;
        if (_.every(node.types, function (entry) { return entry.type === Types.NodeType.STRING_LITERAL; })) {
            var nodeValues = node.types.map(function (type) { return type.value; });
            return this._emitEnum({
                type: Types.NodeType.ENUM,
                values: _.uniq(nodeValues),
            }, this._name(name));
        }
        var unionNodeTypes = node.types.map(function (type) {
            if (type.type !== Types.NodeType.REFERENCE && (type.type !== Types.NodeType.NOT_NULL
                || type.node.type !== Types.NodeType.REFERENCE)) {
                var msg = 'GraphQL unions require that all types are references. Got a '
                    + (type.type === Types.NodeType.NOT_NULL ? type.node.type : type.type);
                throw new Error(msg);
            }
            return (type.type === Types.NodeType.REFERENCE ? type : type.node);
        });
        var firstChild = unionNodeTypes[0];
        var firstChildType = this.types[firstChild.target];
        if (firstChildType.type === Types.NodeType.ENUM) {
            var nodeTypes = unionNodeTypes.map(function (type) {
                var subNode = _this.types[type.target];
                if (subNode.type !== Types.NodeType.ENUM) {
                    throw new Error("ts2gql expected a union of only enums since first child is an enum. Got a " + type.type);
                }
                return subNode.values;
            });
            return this._emitEnum({
                type: Types.NodeType.ENUM,
                values: _.uniq(_.flatten(nodeTypes)),
            }, this._name(name));
        }
        else if (firstChildType.type === Types.NodeType.INTERFACE) {
            var nodeNames = unionNodeTypes.map(function (type) {
                var subNode = _this.types[type.target];
                if (subNode.type !== Types.NodeType.INTERFACE) {
                    throw new Error("ts2gql expected a union of only interfaces since first child is an interface. " +
                        ("Got a " + type.type));
                }
                return type.target;
            });
            return "union " + this._name(name) + " = " + nodeNames.join(' | ');
        }
        else {
            throw new Error("ts2gql currently does not support unions for type: " + firstChildType.type);
        }
    };
    Emitter.prototype._emitInterface = function (node, name) {
        var _this = this;
        // GraphQL expects denormalized type interfaces
        var members = _(this._transitiveInterfaces(node))
            .map(function (i) { return i.members; })
            .flatten()
            .uniqBy('name')
            .sortBy('name')
            .value();
        // GraphQL can't handle empty types or interfaces, but we also don't want
        // to remove all references (complicated).
        if (!members.length) {
            members.push({
                type: Types.NodeType.PROPERTY,
                name: '__placeholder',
                signature: { type: Types.NodeType.BOOLEAN },
            });
        }
        // Schema definition has special treatment on non nullable properties
        if (this._hasDocTag(node, 'schema')) {
            return this._emitSchemaDefinition(members);
        }
        var properties = _.map(members, function (member) {
            if (member.type === Types.NodeType.METHOD) {
                return _this._emitInterfaceMethod(member);
            }
            else if (member.type === Types.NodeType.PROPERTY) {
                return _this._name(member.name) + ": " + _this._emitExpression(member.signature);
            }
            else {
                throw new Error("Can't serialize " + member.type + " as a property of an interface");
            }
        });
        if (this._getDocTag(node, 'input')) {
            return "input " + this._name(name) + " {\n" + this._indent(properties) + "\n}";
        }
        if (node.concrete) {
            return "type " + this._name(name) + " {\n" + this._indent(properties) + "\n}";
        }
        var result = "interface " + this._name(name) + " {\n" + this._indent(properties) + "\n}";
        var fragmentDeclaration = this._getDocTag(node, 'fragment');
        if (fragmentDeclaration) {
            result = result + "\n\n" + fragmentDeclaration + " {\n" + this._indent(members.map(function (m) { return m.name; })) + "\n}";
        }
        return result;
    };
    Emitter.prototype._emitInterfaceMethod = function (member) {
        var parameters = "(" + this._emitMethodArgs(member.parameters) + ")";
        var returnType = this._emitExpression(member.returns);
        var methodDirectives = this._emitMethodDirectives(member.directives);
        return "" + this._name(member.name) + parameters + ": " + returnType + " " + methodDirectives;
    };
    Emitter.prototype._emitMethodArgs = function (node) {
        var _this = this;
        var resolvedArgs = _.mapValues(node.args, function (param) {
            if (param.type === Types.NodeType.REFERENCE) {
                return _this.types[param.target];
            }
            return param;
        });
        return _.map(resolvedArgs, function (argValue, argName) {
            return _this._name(argName) + ": " + _this._emitExpression(argValue);
        }).join(', ');
    };
    Emitter.prototype._emitMethodDirectives = function (directives) {
        var _this = this;
        return _.map(directives, function (directive) {
            var methodArgs = _this._emitMethodArgs(directive.params);
            if (!methodArgs) {
                return "@" + directive.name;
            }
            return "@" + directive.name + "(" + methodArgs + ")";
        }).join(' ');
    };
    Emitter.prototype._emitEnum = function (node, name) {
        return "enum " + this._name(name) + " {\n" + this._indent(node.values) + "\n}";
    };
    Emitter.prototype._emitSchemaDefinition = function (members) {
        var _this = this;
        var properties = _.map(members, function (member) {
            if (member.type !== Types.NodeType.PROPERTY) {
                throw new Error("Can't serialize " + member.type + " as a property of an schema definition");
            }
            var propertySignature = member.signature;
            // Properties of the schema declaration should not contain ! marks
            if (propertySignature.type === Types.NodeType.NOT_NULL) {
                member.signature = propertySignature.node;
            }
            return _this._name(member.name) + ": " + _this._emitExpression(member.signature);
        });
        return "schema {\n" + this._indent(properties) + "\n}";
    };
    Emitter.prototype._isPrimitive = function (node) {
        return node.type === Types.NodeType.STRING || node.type === Types.NodeType.NUMBER
            || node.type === Types.NodeType.BOOLEAN || node.type === Types.NodeType.ANY;
    };
    Emitter.prototype._indent = function (content) {
        if (!_.isArray(content))
            content = content.split('\n');
        return content.map(function (s) { return "  " + s; }).join('\n');
    };
    Emitter.prototype._transitiveInterfaces = function (node) {
        var interfaces = [node];
        try {
            for (var _a = __values(node.inherits), _b = _a.next(); !_b.done; _b = _a.next()) {
                var name = _b.value;
                var inherited = this.types[name];
                interfaces = interfaces.concat(this._transitiveInterfaces(inherited));
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return _.uniq(interfaces);
        var e_4, _c;
    };
    Emitter.prototype._hasDocTag = function (node, prefix) {
        return !!this._getDocTag(node, prefix);
    };
    Emitter.prototype._getDocTag = function (node, prefix) {
        if (!node.documentation)
            return null;
        try {
            for (var _a = __values(node.documentation.tags), _b = _a.next(); !_b.done; _b = _a.next()) {
                var tag = _b.value;
                if (tag.title !== 'graphql')
                    continue;
                if (tag.description.startsWith(prefix))
                    return tag.description;
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return null;
        var e_5, _c;
    };
    return Emitter;
}());
exports.default = Emitter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDBCQUE0QjtBQUU1QiwrQkFBaUM7QUFFakMsMkJBQTJCO0FBQzNCLG1JQUFtSTtBQUNuSTtJQUdFLGlCQUFvQixLQUFtQjtRQUF2QyxpQkFFQztRQUZtQixVQUFLLEdBQUwsS0FBSyxDQUFjO1FBRnZDLFlBQU8sR0FBeUIsRUFBRSxDQUFDO1FBaU5uQyxvQkFBZSxHQUFHLFVBQUMsSUFBZTtZQUNoQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNaLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzlDLE1BQU0sQ0FBQyxLQUFHLElBQUksQ0FBQyxLQUFPLENBQUM7WUFDekIsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDakQsTUFBTSxDQUFJLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFHLENBQUM7WUFDL0MsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDL0MsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLHNCQUFzQjtZQUN6QyxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMs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