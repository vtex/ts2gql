"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var doctrine = require("doctrine");
var typescript = require("typescript");
var types = require("./types");
function documentationForNode(node, source) {
    source = source || node.getSourceFile().text;
    var commentRanges = typescript.getLeadingCommentRanges(source, node.getFullStart());
    if (!commentRanges)
        return undefined;
    // We only care about the closest comment to the node.
    var lastRange = _.last(commentRanges);
    if (!lastRange)
        return undefined;
    var comment = source.substr(lastRange.pos, lastRange.end - lastRange.pos).trim();
    return doctrine.parse(comment, { unwrap: true });
}
exports.documentationForNode = documentationForNode;
function hasDocTag(node, regex) {
    return !!extractTagDescription(node.documentation, regex);
}
exports.hasDocTag = hasDocTag;
function extractTagDescription(doc, regex) {
    if (!doc)
        return null;
    var found = doc.tags.find(function (tag) {
        return tag.title === 'graphql' && regex.test(String(tag.description));
    });
    return found ? String(found.description) : null;
}
exports.extractTagDescription = extractTagDescription;
function isReferenceType(node) {
    return node.kind === types.GQLTypeKind.OBJECT_TYPE || node.kind === types.GQLTypeKind.INTERFACE_TYPE ||
        node.kind === types.GQLTypeKind.ENUM_TYPE || node.kind === types.GQLTypeKind.INPUT_OBJECT_TYPE ||
        node.kind === types.GQLTypeKind.UNION_TYPE || node.kind === types.GQLTypeKind.CUSTOM_SCALAR_TYPE;
}
exports.isReferenceType = isReferenceType;
function isNullableDefinition(node) {
    return node.kind === types.GQLDefinitionKind.UNION_DEFINITION
        || node.kind === types.GQLDefinitionKind.ENUM_DEFINITION || node.kind === types.GQLDefinitionKind.SCALAR_DEFINITION
        || node.kind === types.GQLDefinitionKind.DEFINITION_ALIAS;
}
exports.isNullableDefinition = isNullableDefinition;
function isOutputType(node) {
    if (isWrappingType(node)) {
        return isOutputType(node.wrapped);
    }
    return node.kind === types.GQLTypeKind.ENUM_TYPE || node.kind === types.GQLTypeKind.UNION_TYPE ||
        node.kind === types.GQLTypeKind.INTERFACE_TYPE || node.kind === types.GQLTypeKind.OBJECT_TYPE || isScalar(node);
}
exports.isOutputType = isOutputType;
function isInputType(node) {
    if (isWrappingType(node)) {
        return isInputType(node.wrapped);
    }
    return node.kind === types.GQLTypeKind.ENUM_TYPE || node.kind === types.GQLTypeKind.INPUT_OBJECT_TYPE
        || isScalar(node);
}
exports.isInputType = isInputType;
function isScalar(node) {
    return node.kind === types.GQLTypeKind.CUSTOM_SCALAR_TYPE || isBuiltInScalar(node);
}
exports.isScalar = isScalar;
function isBuiltInScalar(node) {
    return node.kind === types.GQLTypeKind.STRING_TYPE || node.kind === types.GQLTypeKind.INT_TYPE
        || node.kind === types.GQLTypeKind.FLOAT_TYPE || node.kind === types.GQLTypeKind.BOOLEAN_TYPE
        || node.kind === types.GQLTypeKind.ID_TYPE;
}
exports.isBuiltInScalar = isBuiltInScalar;
function isWrappingType(node) {
    return node.kind === types.GQLTypeKind.LIST_TYPE;
}
exports.isWrappingType = isWrappingType;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLG1DQUFxQztBQUNyQyx1Q0FBeUM7QUFDekMsK0JBQWlDO0FBRWpDLFNBQWdCLG9CQUFvQixDQUFDLElBQW9CLEVBQUUsTUFBYztJQUN2RSxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDN0MsSUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUMsYUFBYTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQ3JDLHNEQUFzRDtJQUN0RCxJQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3hDLElBQUksQ0FBQyxTQUFTO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDakMsSUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRW5GLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBVkQsb0RBVUM7QUFFRCxTQUFnQixTQUFTLENBQUMsSUFBeUIsRUFBRSxLQUFZO0lBQy9ELE9BQU8sQ0FBQyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUQsQ0FBQztBQUZELDhCQUVDO0FBRUQsU0FBZ0IscUJBQXFCLENBQUMsR0FBa0MsRUFBRSxLQUFZO0lBQ3BGLElBQUksQ0FBQyxHQUFHO1FBQUUs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