"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Calls `callback` once Mocha has loaded its environment.
 *
 * See https://github.com/mochajs/mocha/issues/764
 */
function withMocha(callback) {
    if ('beforeEach' in global) {
        callback();
        return;
    }
    setImmediate(function () {
        withMocha(callback);
    });
}
exports.withMocha = withMocha;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jaGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi90ZXN0L2hlbHBlcnMvbW9jaGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7OztHQUlHO0FBQ0gsbUJBQTBCLFFBQW1CO0lBQzNDLEVBQUUsQ0FBQyxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQzNCLFFBQVEsRUFBRSxDQUFDO1FBQ1gsTUFBTSxDQUFDO0lBQ1QsQ0FBQztJQUVELFlBQVksQ0FBQztRQUNYLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFURCw4QkFTQyJ9