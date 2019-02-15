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
var typescript = require("typescript");
var path = require("path");
var util = require("./util");
var Collector_1 = require("./Collector");
var Emitter_1 = require("./Emitter");
function load(schemaRootPath, rootNodeNames) {
    var e_1, _a;
    schemaRootPath = path.resolve(schemaRootPath);
    var program = typescript.createProgram([schemaRootPath], {});
    var schemaRoot = program.getSourceFile(schemaRootPath);
    if (!schemaRoot) {
        throw new Error("Could not Parse TypeScript AST of file " + schemaRootPath);
    }
    var interfaces = {};
    typescript.forEachChild(schemaRoot, function (node) {
        if (!isNodeExported(node))
            return;
        if (node.kind === typescript.SyntaxKind.InterfaceDeclaration) {
            var interfaceNode = node;
            interfaces[interfaceNode.name.text] = interfaceNode;
            var documentation = util.documentationForNode(interfaceNode, schemaRoot.text);
            var isSchemaRoot = documentation && _.find(documentation.tags, function (tag) {
                return tag.title === 'graphql' && /^[Ss]chema$/.test(tag.description);
            });
            if (isSchemaRoot) {
                rootNodeNames.push(interfaceNode.name.text);
            }
        }
    });
    rootNodeNames = _.uniq(rootNodeNames);
    if (rootNodeNames.length === 0) {
        throw new Error("GraphQL Schema declaration not found");
    }
    var collector = new Collector_1.Collector(program);
    try {
        for (var rootNodeNames_1 = __values(rootNodeNames), rootNodeNames_1_1 = rootNodeNames_1.next(); !rootNodeNames_1_1.done; rootNodeNames_1_1 = rootNodeNames_1.next()) {
            var name = rootNodeNames_1_1.value;
            var rootInterface = interfaces[name];
            if (!rootInterface) {
                throw new Error("No interface named " + name + " was exported by " + schemaRootPath);
            }
            collector.addRootNode(rootInterface);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (rootNodeNames_1_1 && !rootNodeNames_1_1.done && (_a = rootNodeNames_1.return)) _a.call(rootNodeNames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    _.each(interfaces, function (node, name) {
        var documentation = util.documentationForNode(node);
        if (!documentation)
            return;
        var override = _.find(documentation.tags, function (tag) {
            return tag.title === 'graphql' && /^[Oo]verride$/.test(tag.description);
        });
        if (!override)
            return;
        var overrideName = override.description.split(' ')[1] || name;
        collector.mergeOverrides(node, overrideName);
    });
    return collector;
}
exports.load = load;
function emit(schemaRootPath, rootNodeNames, stream) {
    if (stream === void 0) { stream = process.stdout; }
    var loadedTypes = load(schemaRootPath, rootNodeNames);
    var emitter = new Emitter_1.default(loadedTypes);
    emitter.emitAll(stream);
}
exports.emit = emit;
function isNodeExported(node) {
    return !!node.modifiers && node.modifiers.some(function (m) { return m.kind === typescript.SyntaxKind.ExportKeyword; });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQ0EsMEJBQTRCO0FBQzVCLHVDQUF5QztBQUN6QywyQkFBNkI7QUFFN0IsNkJBQStCO0FBQy9CLHlDQUF1RDtBQUN2RCxxQ0FBZ0M7QUFFaEMsU0FBZ0IsSUFBSSxDQUFDLGNBQXFCLEVBQUUsYUFBc0I7O0lBQ2hFLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzlDLElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMvRCxJQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3pELElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixNQUFNLElBQUksS0FBSyxDQUFDLDRDQUEwQyxjQUFnQixDQUFDLENBQUM7S0FDN0U7SUFFRCxJQUFNLFVBQVUsR0FBa0QsRUFBRSxDQUFDO0lBQ3JFLFVBQVUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLFVBQUMsSUFBSTtRQUN2QyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU87UUFDbEMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLEVBQUU7WUFDNUQsSUFBTSxhQUFhLEdBQW9DLElBQUksQ0FBQztZQUM1RCxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUM7WUFFcEQsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEYsSUFBTSxZQUFZLEdBQUcsYUFBYSxJQUFJLENBQUMsQ0FBQyxJQUFJLENB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