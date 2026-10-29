import type {Furniture,FurnitureKind} from './model';
export type Furniture3DKind=FurnitureKind;
/** Approximate overall heights, independent of footprint and floor levels. */
export const furnitureHeights:Record<Furniture3DKind,number>={
 stairs:3,stairLanding:.2,person:1.7,argentineGrill:1.8,firePit:.45,tree:4.2,palm:5.4,shrub:.9,pottedPlant:1.1,
 smallCar:1.45,mediumCar:1.5,pickup:1.8,nightstand:.55,
 bed:.9,singleBed:.9,sofa:.85,sofa3:.85,armchair:.85,chair:.9,
 table:.75,desk:.75,roundCoffeeTable:.42,wardrobe:2.2,
 toilet:.8,bidet:.42,bathroomSink:.85,kitchenSink:.9,bathtub:.6,
 fridge:1.8,stove:.9,washer:.86,tv:.8,
};
export const isFurniture3D=(kind:FurnitureKind):kind is Furniture3DKind=>Object.hasOwn(furnitureHeights,kind);
export const furnitureHeight=(item:Furniture)=>item.height??(isFurniture3D(item.kind)?furnitureHeights[item.kind]:0);
