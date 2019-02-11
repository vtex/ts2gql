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
var util = require("./util");
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
                if (node.types.length !== 1) {
                    throw new Error("There's no support for inline union with non-null and non-undefined types.");
                }
                return _this._emitExpression(node.types[0]);
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
            if (util.isPrimitive(referencedNode) || referencedNode.type === Types.NodeType.ENUM) {
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
        var aliasTarget = node.target.type === Types.NodeType.NOT_NULL ? node.target.node : node.target;
        if (util.isPrimitive(aliasTarget)) {
            return this._emitScalarDefinition(name);
        }
        else if (aliasTarget.type === Types.NodeType.REFERENCE) {
            return "union " + this._name(name) + " = " + this._emitReference(aliasTarget);
        }
        else if (aliasTarget.type === Types.NodeType.UNION) {
            return this._emitUnion(aliasTarget, name);
        }
        else {
            throw new Error("Can't serialize " + JSON.stringify(aliasTarget, undefined, 1) + " as an alias");
        }
    };
    Emitter.prototype._emitScalarDefinition = function (name) {
        return "scalar " + this._name(name);
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
        if (node.types.length === 1 && util.isPrimitive(node.types[0])) {
            // Since union of scalars is forbidden, interpret as a custom Scalar declaration
            return this._emitScalarDefinition(name);
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
        if (firstChildType.type === Types.NodeType.ALIAS) {
            firstChildType = util.unwrapNotNull(firstChildType.target);
        }
        if (util.isPrimitive(firstChildType)) {
            throw new Error('GraphQL does not support unions with GraphQL Scalars');
        }
        else if (firstChildType.type === Types.NodeType.UNION) {
            throw new Error('GraphQL does not support unions with GraphQL Unions');
        }
        else if (firstChildType.type === Types.NodeType.INTERFACE && !firstChildType.concrete) {
            throw new Error('GraphQL does not support unions with GraphQL Interfaces.');
        }
        else if (firstChildType.type === Types.NodeType.ENUM) {
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
                    var error = 'GraphQL expects an union of only Object Types.';
                    if (subNode.type === Types.NodeType.ALIAS) {
                        var target = util.unwrapNotNull(subNode.target);
                        error = error + (" Got a " + target.type + ".");
                    }
                    throw new Error(error);
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
        return _.map(node.args, function (argValue, argName) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDBCQUE0QjtBQUM1QiwrQkFBaUM7QUFDakMsNkJBQStCO0FBRS9CLDJCQUEyQjtBQUMzQixtSUFBbUk7QUFDbkk7SUFHRSxpQkFBb0IsS0FBbUI7UUFBdkMsaUJBRUM7UUFGbUIsVUFBSyxHQUFMLEtBQUssQ0FBYztRQUZ2QyxZQUFPLEdBQXlCLEVBQUUsQ0FBQztRQTZObkMsb0JBQWUsR0FBRyxVQUFDLElBQWU7WUFDaEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNWLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDWixDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxNQUFNLENBQUMsS0FBRyxJQUFJLENBQUMsS0FBTyxDQUFDO1lBQ3pCLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pELE1BQU0sQ0FBSSxLQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBRyxDQUFDO1lBQy9DLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQy9DLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxzQkFBc0I7WUFDekMsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDL0MsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLDZCQUE2QjtZQUMvQyxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxNQUFNLENBQUMsU0FBUyxDQUFDO1lBQ25CLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xELE1BQU0sQ0FBQyxLQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqQyxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxNQUFNLENBQUMsTUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFHLENBQUM7WUFDcEUsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNqRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ2pDLEdBQUcsQ0FBQyxVQUFDLE1BQXlCO29CQUM3QixNQUFNLENBQUksS0FBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQUssS0FBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFHLENBQUM7Z0JBQ2pGLENBQUMsQ0FBQztxQkFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEIsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDOUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDO2dCQUNoRyxDQUFDO2dCQUNELE1BQU0sQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QyxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBbUIsSUFBSSxDQUFDLElBQUksc0JBQW1CLENBQUMsQ0FBQztZQUNuRSxDQUFDO1FBQ0gsQ0FBQyxDQUFBO1FBRUQsb0JBQWUsR0FBRyxVQUFDLElBQWdEO1lBQ2pFLElBQUksT0FBTyxHQUFnQixFQUFFLENBQUM7WUFDOUIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ3pCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixJQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBb0IsQ0FBQztnQkFDOUMsSUFBSSxhQUFhLFNBQXlCLENBQUM7Z0JBQzNDLGFBQWEsR0FBRyxJQUFJLENBQUM7Z0JBRXJCLHVEQUF1RDtnQkFDdkQsT0FBTyxhQUFhLEVBQUUsQ0FBQzs7d0JBQ3JCLEdBQUcsQ0FBQyxDQUFpQixJQUFBLEtBQUEsU0FBQSxhQUFhLENBQUMsT0FBTyxDQUFBLGdCQUFBOzRCQUFyQyxJQUFNLE1BQU0sV0FBQTs0QkFDZixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQ0FBQyxRQUFRLENBQUM7NEJBQ3pDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3lCQUN0Qjs7Ozs7Ozs7O29CQUNELEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3RDLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQXdDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBRyxDQUFDLENBQUM7b0JBQ3BHLENBQUM7b0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQy9DLElBQU0sU0FBUyxHQUFjLEtBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNuRSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzs0QkFDaEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBK0MsU0FBVyxDQUFDLENBQUM7d0JBQzlFLENBQUM7d0JBQ0QsYUFBYSxHQUFHLFNBQVMsQ0FBQztvQkFDNUIsQ0FBQztvQkFBQyxJQUFJLENBQUMsQ0FBQzt3QkFDTixhQUFhLEdBQUcsSUFBSSxDQUFDO29CQUN2QixDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDOztnQkFFRCxHQUFHLENBQUMsQ0FBaUIsSUFBQSxZQUFBLFNBQUEsT0FBTyxDQUFBLGdDQUFBO29CQUF2QixJQUFNLE1BQU0sb0JBQUE7b0JBQ2YsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQzVDLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTBDLE1BQU0sQ0FBQyxJQUFNLENBQUMsQ0FBQztvQkFDM0UsQ0FBQztpQkFDRjs7Ozs7Ozs7O1lBQ0QsTUFBTSxDQUFDLE9BQStCLENBQUM7O1FBQ3pDLENBQUMsQ0FBQTtRQWtCRCxVQUFVO1FBRVYsVUFBSyxHQUFHLFVBQUMsSUFBcUI7WUFDNUIsSUFBSSxHQUFHLEtBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUE7UUF0VEMsSUFBSSxDQUFDLEtBQUssR0FBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsVUFBQyxJQUFJLEVBQUUsSUFBSSxJQUFLLE9BQUEsS0FBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSyxDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBRUQseUJBQU8sR0FBUCxVQUFRLE1BQTRCO1FBQXBDLGlCQUdDO1FBRkMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuQixDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsVUFBQyxJQUFJLEVBQUUsSUFBSSxJQUFLLE9BQUEsS0FBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFLLEVBQUUsTUFBTSxDQUFDLEVBQTFDLENBQTBDLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBRUQsa0NBQWdCLEdBQWhCLFVBQWlCLElBQWUsRUFBRSxJQUFxQixFQUFFLE1BQTRCO1FBQ25GLElBQUksT0FBTyxDQUFDO1FBQ1osRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDdkMsT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3hDLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbEQsT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDN0MsT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTBCLElBQUksQ0FBQyxJQUFJLHlCQUFzQixDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUNELE1BQU0sQ0FBQyxLQUFLLENBQUksT0FBTyxTQUFNLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsZ0JBQWdCO0lBRWhCLGlDQUFlLEdBQWYsVUFBZ0IsSUFBZSxFQUFFLElBQXFCO1FBQ3BELElBQU0sV0FBVyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUUzQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4RixJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsSUFBSSxjQUFjLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDcEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztnQkFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztnQkFDOUMsR0FBRyxDQUFDLENBQWMsSUFBQSxnQkFBQSxTQUFBLFdBQVcsQ0FBQSx3Q0FBQTtvQkFBeEIsSUFBTSxHQUFHLHdCQUFBO29CQUNaLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDL0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUM7d0JBQ3pCLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQ2QsQ0FBQztpQkFDRjs7Ozs7Ozs7O1FBQ0gsQ0FBQztRQUVELE1BQU0sQ0FBQyxLQUFLLENBQUM7O0lBQ2YsQ0FBQztJQUVELFFBQVE7SUFFUiw0QkFBVSxHQUFWLFVBQVcsSUFBb0IsRUFBRSxJQUFxQjtRQUNwRCxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFFbEcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3pELE1BQU0sQ0FBQyxXQUFTLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUcsQ0FBQztRQUMzRSxDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFtQixJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLGlCQUFjLENBQUMsQ0FBQztRQUM5RixDQUFDO0lBQ0gsQ0FBQztJQUVELHVDQUFxQixHQUFyQixVQUFzQixJQUFxQjtRQUN6QyxNQUFNLENBQUMsWUFBVSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBRyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxnQ0FBYyxHQUFkLFVBQWUsSUFBd0I7UUFDckMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCw0QkFBVSxHQUFWLFVBQVcsSUFBb0IsRUFBRSxJQUFxQjtRQUF0RCxpQkFxRUM7UUFwRUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBNUMsQ0FBNEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvRSxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLElBQTRCLElBQUssT0FBQSxJQUFJLENBQUMsS0FBSyxFQUFWLENBQVUsQ0FBQyxDQUFDO1lBQ2hGLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNwQixJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJO2dCQUN6QixNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7YUFDM0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdkIsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL0QsZ0ZBQWdGO1lBQ2hGLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUVELElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQUMsSUFBSTtZQUN6QyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVE7bUJBQy9FLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNuRCxJQUFNLEdBQUcsR0FBRyw4REFBOEQ7c0JBQ3hFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdkUsTUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUV2QixDQUFDO1lBQ0QsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBMkIsQ0FBQyxDQUFDO1FBQzVGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBTSxVQUFVLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25ELEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2pELGNBQWMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDeEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLE1BQU0sSUFBSSxLQUFLLENBQUMsMERBQTBELENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELElBQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBQyxJQUF3QjtnQkFDNUQsSUFBTSxPQUFPLEdBQUcsS0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3hDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUN6QyxNQUFNLElBQUksS0FBSyxDQUFDLCtFQUE2RSxJQUFJLENBQUMsSUFBTSxDQUFDLENBQUM7Z0JBQzVHLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7WUFDeEIsQ0FBQyxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDcEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSTtnQkFDekIsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNyQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUV2QixDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzVELElBQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBQyxJQUF3QjtnQkFFNUQsSUFBTSxPQUFPLEdBQUcsS0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3hDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUM5QyxJQUFJLEtBQUssR0FBRyxnREFBZ0QsQ0FBQztvQkFDN0QsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7d0JBQzFDLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUNsRCxLQUFLLEdBQUcsS0FBSyxJQUFHLFlBQVUsTUFBTSxDQUFDLElBQUksTUFBRyxDQUFBLENBQUM7b0JBQzNDLENBQUM7b0JBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDekIsQ0FBQztnQkFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUNyQixDQUFDLENBQUMsQ0FBQztZQUNILE1BQU0sQ0FBQyxXQUFTLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQU0sU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUcsQ0FBQztRQUNoRSxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLHdEQUFzRCxjQUFjLENBQUMsSUFBTSxDQUFDLENBQUM7UUFDL0YsQ0FBQztJQUNILENBQUM7SUFFRCxnQ0FBYyxHQUFkLFVBQWUsSUFBd0IsRUFBRSxJQUFxQjtRQUE5RCxpQkFpREM7UUFoREMsK0NBQStDO1FBQy9DLElBQU0sT0FBTyxHQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzlELEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxPQUFPLEVBQVQsQ0FBUyxDQUFDO2FBQ25CLE9BQU8sRUFBRTthQUNULE1BQU0sQ0FBQyxNQUFNLENBQUM7YUFDZCxNQUFNLENBQUMsTUFBTSxDQUFDO2FBQ2QsS0FBSyxFQUFFLENBQUM7UUFFWCx5RUFBeUU7UUFDekUsMENBQTBDO1FBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDcEIsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFDWCxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRO2dCQUM3QixJQUFJLEVBQUUsZUFBZTtnQkFDckIsU0FBUyxFQUFFLEVBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFDO2FBQzFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxxRUFBcUU7UUFDckUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUVELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLFVBQUMsTUFBTTtZQUN2QyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDMUMsTUFBTSxDQUFDLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzQyxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNuRCxNQUFNLENBQUksS0FBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQUssS0FBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFHLENBQUM7WUFDakYsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQW1CLE1BQU0sQ0FBQyxJQUFJLG1DQUFnQyxDQUFDLENBQUM7WUFDbEYsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLE1BQU0sQ0FBQyxXQUFTLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBSyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNsQixNQUFNLENBQUMsVUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQUssQ0FBQztRQUN0RSxDQUFDO1FBRUQsSUFBSSxNQUFNLEdBQUcsZUFBYSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQUssQ0FBQztRQUMvRSxJQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzlELEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztZQUN4QixNQUFNLEdBQU0sTUFBTSxZQUFPLG1CQUFtQixZQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQUssSUFBSyxPQUFBLENBQUMsQ0FBQyxJQUFJLEVBQU4sQ0FBTSxDQUFDLENBQUMsUUFBSyxDQUFDO1FBQ3ZHLENBQUM7UUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxzQ0FBb0IsR0FBcEIsVUFBcUIsTUFBdUI7UUFDMUMsSUFBTSxVQUFVLEdBQUcsTUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBRyxDQUFDO1FBQ2xFLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hELElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN2RSxNQUFNLENBQUMsS0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxVQUFVLFVBQUssVUFBVSxTQUFJLGdCQUFrQixDQUFDO0lBQ3RGLENBQUM7SUFFRCxpQ0FBZSxHQUFmLFVBQWdCLElBQTJCO1FBQTNDLGlCQUlDO1FBSEMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxVQUFDLFFBQW1CLEVBQUUsT0FBYztZQUMxRCxNQUFNLENBQUksS0FBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBSyxLQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBRyxDQUFDO1FBQ3JFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoQixDQUFDO0lBRUQsdUNBQXFCLEdBQXJCLFVBQXNCLFVBQWdDO1FBQXRELGlCQVFDO1FBUEMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLFVBQUMsU0FBNkI7WUFDckQsSUFBTSxVQUFVLEdBQUcsS0FBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDMUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNoQixNQUFNLENBQUMsTUFBSSxTQUFTLENBQUMsSUFBTSxDQUFDO1lBQzlCLENBQUM7WUFDRCxNQUFNLENBQUMsTUFBSSxTQUFTLENBQUMsSUFBSSxTQUFJLFVBQVUsTUFBRyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNmLENBQUM7SUFFRCwyQkFBUyxHQUFULFVBQVUsSUFBbUIsRUFBRSxJQUFxQjtRQUNsRCxNQUFNLENBQUMsVUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFLLENBQUM7SUFDdkUsQ0FBQztJQXlFRCx1Q0FBcUIsR0FBckIsVUFBc0IsT0FBb0I7UUFBMUMsaUJBY0M7UUFiQyxJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxVQUFDLE1BQU07WUFDdkMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzVDLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQW1CLE1BQU0sQ0FBQyxJQUFJLDJDQUF3QyxDQUFDLENBQUM7WUFDMUYsQ0FBQztZQUNELElBQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztZQUN6QyxrRUFBa0U7WUFDbEUsRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDdkQsTUFBTSxDQUFDLFNBQVMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7WUFDNUMsQ0FBQztZQUNELE1BQU0sQ0FBSSxLQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBSyxLQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUcsQ0FBQztRQUNuRixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxlQUFhLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQUssQ0FBQztJQUNwRCxDQUFDO0lBU0QseUJBQU8sR0FBUCxVQUFRLE9BQXVCO1FBQzdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsT0FBSyxDQUFHLEVBQVIsQ0FBUSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCx1Q0FBcUIsR0FBckIsVUFBc0IsSUFBd0I7UUFDNUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7WUFDeEIsR0FBRyxDQUFDLENBQWUsSUFBQSxLQUFBLFNBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQSxnQkFBQTtnQkFBM0IsSUFBTSxJQUFJLFdBQUE7Z0JBQ2IsSUFBTSxTQUFTLEdBQXdCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hELFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2FBQ3ZFOzs7Ozs7Ozs7UUFDRCxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzs7SUFDNUIsQ0FBQztJQUVELDRCQUFVLEdBQVYsVUFBVyxJQUFzQixFQUFFLE1BQWE7UUFDOUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsNEJBQVUsR0FBVixVQUFXLElBQXNCLEVBQUUsTUFBYTtRQUM5QyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7WUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDOztZQUNyQyxHQUFHLENBQUMsQ0FBYyxJQUFBLEtBQUEsU0FBQSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQSxnQkFBQTtnQkFBcEMsSUFBTSxHQUFHLFdBQUE7Z0JBQ1osRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssS0FBSyxTQUFTLENBQUM7b0JBQUMsUUFBUSxDQUFDO2dCQUN0QyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQzthQUNoRTs7Ozs7Ozs7O1FBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQzs7SUFDZCxDQUFDO0lBRUgsY0FBQztBQUFELENBQUMsQUF2VkQsSUF1VkMifQ==