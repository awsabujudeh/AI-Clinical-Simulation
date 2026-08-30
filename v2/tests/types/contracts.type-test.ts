import type {
  ActionId,
  CaseId,
  ClockAdapter,
  CommandId,
  EventId,
  HashAdapter,
  InstitutionId,
  LoggerAdapter,
  PersistenceAdapter,
  RandomSeedAdapter,
  SchemaVersion,
  SemanticVersion,
  SessionId,
  StorageAdapter
} from "../../packages/contracts/src/index.ts";

type Assert<T extends true> = T;
type IsAssignable<From, To> = From extends To ? true : false;

type _CaseIdIsString = Assert<IsAssignable<CaseId, string>>;
type _PlainStringIsNotCaseId = Assert<IsAssignable<string, CaseId> extends false ? true : false>;
type _ActionIdIsNotEventId = Assert<IsAssignable<ActionId, EventId> extends false ? true : false>;
type _InstitutionIdIsNotCaseId = Assert<IsAssignable<InstitutionId, CaseId> extends false ? true : false>;
type _SessionIdIsNotCommandId = Assert<IsAssignable<SessionId, CommandId> extends false ? true : false>;
type _SchemaVersionIsNotSemanticVersion = Assert<
  IsAssignable<SchemaVersion, SemanticVersion> extends false ? true : false
>;
type _SemanticVersionIsNotSchemaVersion = Assert<
  IsAssignable<SemanticVersion, SchemaVersion> extends false ? true : false
>;

type _AdapterSurface = [
  ClockAdapter,
  PersistenceAdapter<Record<string, never>, null>,
  StorageAdapter,
  LoggerAdapter,
  RandomSeedAdapter,
  HashAdapter
];

export type ContractTypeAssertions = [
  _CaseIdIsString,
  _PlainStringIsNotCaseId,
  _ActionIdIsNotEventId,
  _InstitutionIdIsNotCaseId,
  _SessionIdIsNotCommandId,
  _SchemaVersionIsNotSemanticVersion,
  _SemanticVersionIsNotSchemaVersion,
  _AdapterSurface
];
