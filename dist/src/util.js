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
function isPrimitive(node) {
    var unwrapped = unwrapNotNull(node);
    return unwrapped.type === types.NodeType.STRING || unwrapped.type === types.NodeType.NUMBER
        || unwrapped.type === types.NodeType.BOOLEAN || unwrapped.type === types.NodeType.ANY;
}
exports.isPrimitive = isPrimitive;
function unwrapNotNull(node) {
    var unwrapped = node;
    while (unwrapped.type === types.NodeType.NOT_NULL) {
        unwrapped = unwrapped.node;
    }
    return unwrapped;
}
exports.unwrapNotNull = unwrapNotNull;
function wrapNotNull(node) {
    if (node.type === types.NodeType.NOT_NULL) {
        return node;
    }
    return {
        type: types.NodeType.NOT_NULL,
        node: node,
    };
}
exports.wrapNotNull = wrapNotNull;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLG1DQUFxQztBQUNyQyx1Q0FBeUM7QUFDekMsK0JBQWlDO0FBRWpDLFNBQWdCLG9CQUFvQixDQUFDLElBQW9CLEVBQUUsTUFBYztJQUN2RSxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDN0MsSUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUMsYUFBYTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQ3JDLHNEQUFzRDtJQUN0RCxJQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3hDLElBQUksQ0FBQyxTQUFTO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDakMsSUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRW5GLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBVkQsb0RBVUM7QUFFRCxTQUFnQixXQUFXLENBQUMsSUFBZTtJQUN6QyxJQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsT0FBTyxTQUFTLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNO1dBQ3hGLFNBQVMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQztBQUN4RixDQUFDO0FBSkQsa0NBSUM7QUFFRCxTQUFnQixhQUFhLENBQUMsSUFBZTtJQUMzQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDckIsT0FBTyxTQUFTLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFO1FBQ2pELFNBQVMsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO0tBQzVCO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQU5ELHNDQU1DO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLElBQWU7SUFDekMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFO1FBQ3pDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUTtRQUM3QixJQUFJLE1BQUE7S0FDTCxDQUFDO0FBQ0osQ0FBQztBQVJELGtDQVFDIn0=