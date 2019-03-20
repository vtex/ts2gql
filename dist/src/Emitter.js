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
            var e_1, _a, e_2, _b;
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
                        for (var _c = __values(interfaceNode.members), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var member = _d.value;
                            if (seenProps.has(member.name))
                                continue;
                            seenProps.add(member.name);
                            members.push(member);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
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
                    if (members_1_1 && !members_1_1.done && (_b = members_1.return)) _b.call(members_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return members;
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
        var e_3, _a;
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
                name: '_placeholder',
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
        var e_4, _a;
        var interfaces = [node];
        try {
            for (var _b = __values(node.inherits), _c = _b.next(); !_c.done; _c = _b.next()) {
                var name = _c.value;
                var inherited = this.types[name];
                interfaces = interfaces.concat(this._transitiveInterfaces(inherited));
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return _.uniq(interfaces);
    };
    Emitter.prototype._hasDocTag = function (node, prefix) {
        return !!this._getDocTag(node, prefix);
    };
    Emitter.prototype._getDocTag = function (node, prefix) {
        var e_5, _a;
        if (!node.documentation)
            return null;
        try {
            for (var _b = __values(node.documentation.tags), _c = _b.next(); !_c.done; _c = _b.next()) {
                var tag = _c.value;
                if (tag.title !== 'graphql')
                    continue;
                if (tag.description.startsWith(prefix))
                    return tag.description;
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return null;
    };
    return Emitter;
}());
exports.default = Emitter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDBCQUE0QjtBQUM1QiwrQkFBaUM7QUFDakMsNkJBQStCO0FBRS9CLDJCQUEyQjtBQUMzQixtSUFBbUk7QUFDbkk7SUFHRSxpQkFBb0IsS0FBbUI7UUFBdkMsaUJBRUM7UUFGbUIsVUFBSyxHQUFMLEtBQUssQ0FBYztRQUZ2QyxZQUFPLEdBQXlCLEVBQUUsQ0FBQztRQTZObkMsb0JBQWUsR0FBRyxVQUFDLElBQWU7WUFDaEMsSUFBSSxDQUFDLElBQUksRUFBRTtnQkFDVCxPQUFPLEVBQUUsQ0FBQzthQUNYO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRTtnQkFDN0MsT0FBTyxLQUFHLElBQUksQ0FBQyxLQUFPLENBQUM7YUFDeEI7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFO2dCQUNoRCxPQUFVLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFHLENBQUM7YUFDOUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO2dCQUM5QyxPQUFPLFFBQVEsQ0FBQyxDQUFDLHNCQUFzQjthQUN4QztpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUU7Z0JBQzlDLE9BQU8sT0FBTyxDQUFDLENBQUMsNkJBQTZCO2FBQzlDO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRTtnQkFDL0MsT0FBTyxTQUFTLENBQUM7YUFDbEI7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFB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