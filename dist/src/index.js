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
    schemaRootPath = path.resolve(schemaRootPath);
    var program = typescript.createProgram([schemaRootPath], {});
    var schemaRoot = program.getSourceFile(schemaRootPath);
    var interfaces = {};
    typescript.forEachChild(schemaRoot, function (node) {
        if (!isNodeExported(node))
            return;
        if (node.kind === typescript.SyntaxKind.InterfaceDeclaration) {
            var interfaceNode = node;
            interfaces[interfaceNode.name.text] = interfaceNode;
            var documentation = util.documentationForNode(interfaceNode, schemaRoot.text);
            if (documentation && _.find(documentation.tags, { title: 'graphql', description: 'schema' })) {
                rootNodeNames.push(interfaceNode.name.text);
            }
        }
    });
    rootNodeNames = _.uniq(rootNodeNames);
    var collector = new Collector_1.default(program);
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
        var override = _.find(documentation.tags, function (t) { return t.title === 'graphql' && t.description.startsWith('override'); });
        if (!override)
            return;
        var overrideName = override.description.split(' ')[1] || name;
        collector.mergeOverrides(node, overrideName);
    });
    return collector.types;
    var e_1, _a;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsMEJBQTRCO0FBQzVCLHVDQUF5QztBQUN6QywyQkFBNkI7QUFHN0IsNkJBQStCO0FBQy9CLHlDQUFvQztBQUNwQyxxQ0FBZ0M7QUFFaEMsY0FBcUIsY0FBcUIsRUFBRSxhQUFzQjtJQUNoRSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUM5QyxJQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsY0FBYyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDL0QsSUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUV6RCxJQUFNLFVBQVUsR0FBa0QsRUFBRSxDQUFDO0lBQ3JFLFVBQVUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLFVBQUMsSUFBSTtRQUN2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUFDLE1BQU0sQ0FBQztRQUNsQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1lBQzdELElBQU0sYUFBYSxHQUFvQyxJQUFJLENBQUM7WUFDNUQsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDO1lBRXBELElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hGLEVBQUUsQ0FBQyxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsRUFBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFdB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