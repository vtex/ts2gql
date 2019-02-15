"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GQLDefinitionKind;
(function (GQLDefinitionKind) {
    // Definitions
    GQLDefinitionKind["OBJECT_DEFINITION"] = "object definition";
    GQLDefinitionKind["INTERFACE_DEFINITION"] = "interface definition";
    GQLDefinitionKind["ENUM_DEFINITION"] = "enum definition";
    GQLDefinitionKind["INPUT_OBJECT_DEFINITION"] = "input object definition";
    GQLDefinitionKind["UNION_DEFINITION"] = "union definition";
    GQLDefinitionKind["SCALAR_DEFINITION"] = "scalar definition";
    GQLDefinitionKind["FIELD_DEFINITION"] = "field definition";
    GQLDefinitionKind["INPUT_VALUE_DEFINITION"] = "input value definition";
    GQLDefinitionKind["ENUM_FIELD_DEFINITION"] = "enum field definition";
    GQLDefinitionKind["DEFINITION_ALIAS"] = "definition alias";
    // Directives
    GQLDefinitionKind["DIRECTIVE"] = "directive";
    GQLDefinitionKind["DIRECTIVE_INPUT_VALUE_DEFINITION"] = "directive input value definition";
})(GQLDefinitionKind = exports.GQLDefinitionKind || (exports.GQLDefinitionKind = {}));
var GQLTypeKind;
(function (GQLTypeKind) {
    // Wrapping Types
    GQLTypeKind["LIST_TYPE"] = "list";
    // Types
    GQLTypeKind["REFERENCE"] = "reference";
    GQLTypeKind["OBJECT_TYPE"] = "object type";
    GQLTypeKind["INTERFACE_TYPE"] = "interface type";
    GQLTypeKind["ENUM_TYPE"] = "enum type";
    GQLTypeKind["INPUT_OBJECT_TYPE"] = "input object type";
    GQLTypeKind["UNION_TYPE"] = "union type";
    GQLTypeKind["CIRCULAR_TYPE"] = "circular type";
    GQLTypeKind["CUSTOM_SCALAR_TYPE"] = "custom scalar";
    GQLTypeKind["STRING_TYPE"] = "string";
    GQLTypeKind["INT_TYPE"] = "int";
    GQLTypeKind["FLOAT_TYPE"] = "float";
    GQLTypeKind["BOOLEAN_TYPE"] = "boolean";
    GQLTypeKind["ID_TYPE"] = "id";
    // Values
    GQLTypeKind["STRING_LITERAL"] = "string literal";
    GQLTypeKind["VALUE"] = "value";
})(GQLTypeKind = exports.GQLTypeKind || (exports.GQLTypeKind = {}));
var GQLTypeCategory;
(function (GQLTypeCategory) {
    GQLTypeCategory["INPUT"] = "input";
    GQLTypeCategory["OUTPUT"] = "output";
})(GQLTypeCategory = exports.GQLTypeCategory || (exports.GQLTypeCategory = {}));
exports.DefinitionFromType = new Map([
    [GQLDefinitionKind.OBJECT_DEFINITION, GQLTypeKind.OBJECT_TYPE],
    [GQLDefinitionKind.INTERFACE_DEFINITION, GQLTypeKind.INTERFACE_TYPE],
    [GQLDefinitionKind.ENUM_DEFINITION, GQLTypeKind.ENUM_TYPE],
    [GQLDefinitionKind.INPUT_OBJECT_DEFINITION, GQLTypeKind.INPUT_OBJECT_TYPE],
    [GQLDefinitionKind.UNION_DEFINITION, GQLTypeKind.UNION_TYPE],
    [GQLDefinitionKind.SCALAR_DEFINITION, GQLTypeKind.CUSTOM_SCALAR_TYPE],
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFlQSxJQUFZLGlCQWVYO0FBZkQsV0FBWSxpQkFBaUI7SUFDM0IsY0FBYztJQUNkLDREQUF1QyxDQUFBO0lBQ3ZDLGtFQUE2QyxDQUFBO0lBQzdDLHdEQUFtQyxDQUFBO0lBQ25DLHdFQUFtRCxDQUFBO0lBQ25ELDBEQUFxQyxDQUFBO0lBQ3JDLDREQUF1QyxDQUFBO0lBQ3ZDLDBEQUFxQyxDQUFBO0lBQ3JDLHNFQUFpRCxDQUFBO0lBQ2pELG9FQUErQyxDQUFBO0lBQy9DLDBEQUFxQyxDQUFBO0lBQ3JDLGFBQWE7SUFDYiw0Q0FBdUIsQ0FBQTtJQUN2QiwwRkFBcUUsQ0FBQTtBQUN2RSxDQUFDLEVBZlcsaUJBQWlCLEdBQWpCLHlCQUFpQixLQUFqQix5QkFBaUIsUUFlNUI7QUFFRCxJQUFZLFdBb0JYO0FBcEJELFdBQVksV0FBVztJQUNyQixpQkFBaUI7SUFDakIsaUNBQWtCLENBQUE7SUFDbEIsUUFBUTtJQUNSLHNDQUF1QixDQUFBO0lBQ3ZCLDBDQUEyQixDQUFBO0lBQzNCLGdEQUFpQyxDQUFBO0lBQ2pDLHNDQUF1QixDQUFBO0lBQ3ZCLHNEQUF1QyxDQUFBO0lBQ3ZDLHdDQUF5QixDQUFBO0lBQ3pCLDhDQUErQixDQUFBO0lBQy9CLG1EQUFvQyxDQUFBO0lBQ3BDLHFDQUFzQixDQUFBO0lBQ3RCLCtCQUFnQixDQUFBO0lBQ2hCLG1DQUFvQixDQUFBO0lBQ3BCLHVDQUF3QixDQUFBO0lBQ3hCLDZCQUFjLENBQUE7SUFDZCxTQUFTO0lBQ1QsZ0RBQWlDLENBQUE7SUFDakMsOEJBQWUsQ0FBQTtBQUNqQixDQUFDLEVBcEJXLFdBQVcsR0FBWCxtQkFBVyxLQUFYLG1CQUFXLFFBb0J0QjtBQTZIRCxJQUFZLGVBR1g7QUFIRCxXQUFZLGVBQWU7SUFDekIsa0NBQWUsQ0FBQTtJQUNmLG9DQUFpQixDQUFBO0FBQ25CLENBQUMsRUFIVyxlQUFlLEdBQWYsdUJBQWUsS0FBZix1QkFBZSxRQUcxQjtBQWlDWSxRQUFBLGtCQUFrQixHQUFHLElBQUksR0FBRyxDQUErQztJQUN0RixDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUM7SUFDOUQsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRSxXQUFXLENBQUMsY0FBYyxDQUFDO0lBQ3BFLENBQUMsaUJBQWlCLENBQUMsZUFBZSxFQUFFLFdBQVcsQ0FBQyxTQUFTLENBQUM7SUFDMUQsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsRUFBRSxXQUFXLENBQUMsaUJBQWlCLENBQUM7SUFDMUUsQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDO0lBQzVELENBQUMsaUJBQWlCLENBQUMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLGtCQUFrQixDQUFDO0NBQ3RFLENBQUMsQ0FBQyJ9