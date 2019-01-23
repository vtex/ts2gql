"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var doctrine = require("doctrine");
var typescript = require("typescript");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEJBQTRCO0FBQzVCLG1DQUFxQztBQUNyQyx1Q0FBeUM7QUFFekMsOEJBQXFDLElBQW9CLEVBQUUsTUFBYztJQUN2RSxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDN0MsSUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUN0RixFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQztRQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7SUFDckMsc0RBQXNEO0lBQ3RELElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDeEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ2pDLElBQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsR0FBRyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUVuRixNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBVkQsb0RBVUMifQ==