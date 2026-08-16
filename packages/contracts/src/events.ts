export type EventsFor<
  Id extends string,
  Map extends Record<`${Id}.${string}`, unknown>,
> = Map;

type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I
  : never;

export type MergeEventMaps<Maps extends readonly object[]> =
  UnionToIntersection<Maps[number]> extends infer R extends object ? R : never;
