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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLG1DQUFxQztBQUNyQyx1Q0FBeUM7QUFDekMsK0JBQWlDO0FBRWpDLDhCQUFxQyxJQUFvQixFQUFFLE1BQWM7SUFDdkUsTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQzdDLElBQU0sYUFBYSxHQUFHLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7SUFDdEYsRUFBRSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7UUFBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ3JDLHNEQUFzRDtJQUN0RCxJQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3hDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNqQyxJQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLEdBQUcsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFbkYsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUMsTUFBTSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7QUFDakQsQ0FBQztBQVZELG9EQVVDO0FBRUQscUJBQTRCLElBQWU7SUFDekMsSUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNO1dBQ3hGLFNBQVMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQztBQUN4RixDQUFDO0FBSkQsa0NBSUM7QUFFRCx1QkFBOEIsSUFBZTtJQUMzQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDckIsT0FBTyxTQUFTLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbEQsU0FBUyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7SUFDN0IsQ0FBQztJQUNELE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQU5ELHNDQU1DO0FBRUQscUJBQTRCLElBQWU7SUFDekMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxNQUFNLENBQUM7UUFDTCxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRO1FBQzdCLElBQUksTUFBQTtLQUNMLENBQUM7QUFDSixDQUFDO0FBUkQsa0NBUUMifQ==