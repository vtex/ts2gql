"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Emitter_1 = require("../../src/Emitter");
var ts2gql = require("../../src/index");
describe("Emitter", function () {
    var loadedTypes;
    var emitter;
    beforeEach(function () {
        var collector = ts2gql.load('./test/schema.ts', ['Schema']);
        loadedTypes = collector.resolved;
        emitter = new Emitter_1.default(collector);
    });
    describe("_emitUnion", function () {
        it("emits GQL type union for union of interface types", function () {
            var expected = "union FooSearchResult = Human | Droid | Starship";
            var unionNode = loadedTypes['UnionOfInterfaceTypes'];
            var val = emitter._emitUnion(unionNode, 'FooSearchResult');
            expect(val).to.eq(expected);
        });
        it("emits GQL enum union for union of enum types", function () {
            var expected = "enum FooSearchResult {\n  Red\n  Yellow\n  Blue\n  Big\n  Small\n}";
            var unionNode = loadedTypes['UnionOfEnumTypes'];
            var val = emitter._emitUnion(unionNode, 'FooSearchResult');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum union for a union type of strings", function () {
            var expected = "enum QuarkFlavor {\n  UP\n  DOWN\n  CHARM\n  STRANGE\n  TOP\n  BOTTOM\n}";
            var unionNode = loadedTypes['QuarkFlavor'];
            var val = emitter._emitUnion(unionNode, 'QuarkFlavor');
            expect(val).to.eq(expected);
        });
        it("throws error if union combines interfaces with other node types", function () {
            var unionNode = loadedTypes['UnionOfInterfaceAndOtherTypes'];
            expect(function () {
                emitter._emitUnion(unionNode, 'FooSearchResult');
            }).to.throw('ts2gql expected a union of only interfaces since first child is an interface. Got a reference');
        });
        it("throws error if union combines enums with other node types", function () {
            var unionNode = loadedTypes['UnionOfEnumAndOtherTypes'];
            expect(function () {
                emitter._emitUnion(unionNode, 'FooSearchResult');
            }).to.throw('ts2gql expected a union of only enums since first child is an enum. Got a reference');
        });
        it("throws error if union contains non-reference types", function () {
            var unionNode = loadedTypes['UnionOfNonReferenceTypes'];
            expect(function () {
                emitter._emitUnion(unionNode, 'FooSearchResult');
            }).to.throw('GraphQL unions require that all types are references. Got a boolean');
        });
    });
    describe("_emitEnum", function () {
        it("emits GQL type enum for string enum with single quotes", function () {
            var expected = "enum Planet {\n  CHTHONIAN\n  CIRCUMBINARY\n  PLUTOID\n}";
            var enumNode = loadedTypes['Planet'];
            var val = emitter._emitEnum(enumNode, 'Planet');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum for string enum with double quotes", function () {
            var expected = "enum Seasons {\n  SPRING\n  SUMMER\n  FALL\n  WINTER\n}";
            var enumNode = loadedTypes['Seasons'];
            var val = emitter._emitEnum(enumNode, 'Seasons');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum for enum with 'any' typed initializers", function () {
            var expected = "enum Cloud {\n  ALTOSTRATUS\n  CIRROCUMULUS\n  CUMULONIMBUS\n}";
            var enumNode = loadedTypes['Cloud'];
            var val = emitter._emitEnum(enumNode, 'Cloud');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum for enum with numeric literal initializers", function () {
            var expected = "enum Ordinal {\n  FIRST\n  SECOND\n  THIRD\n}";
            var enumNode = loadedTypes['Ordinal'];
            var val = emitter._emitEnum(enumNode, 'Ordinal');
            expect(val).to.eq(expected);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3Rlc3QvaW50ZWdyYXRpb24vRW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDZDQUF3QztBQUN4Qyx3Q0FBMEM7QUFHMUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtJQUVsQixJQUFJLFdBQW1DLENBQUM7SUFDeEMsSUFBSSxPQUFlLENBQUM7SUFDcEIsVUFBVSxDQUFDO1FBQ1QsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDOUQsV0FBVyxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7UUFDakMsT0FBTyxHQUFHLElBQUksaUJBQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxZQUFZLEVBQUU7UUFDckIsRUFBRSxDQUFDLG1EQUFtRCxFQUFFO1lBQ3RELElBQU0sUUFBUSxHQUFHLGtEQUFrRCxDQUFDO1lBQ3BFLElBQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBa0MsQ0FBQztZQUN4RixJQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQzdELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLDhDQUE4QyxFQUFFO1lBQ2pELElBQU0sUUFBUSxHQUNwQixvRUFNRSxDQUFDO1lBQ0csSUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLGtCQUFrQixDQUFrQyxDQUFDO1lBQ25GLElBQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDN0QsTUFBTSxDQUFDLEdB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