export type DeliveryPackSectionId =
  | 'agent-instructions'
  | 'skills'
  | 'mcp-governance'
  | 'testing'
  | 'ai-act-readiness'
  | 'client-handoff'
  | 'context'
  | 'security-data'
  | 'root';

export type DeliveryPackFileKind =
  | 'markdown'
  | 'yaml'
  | 'json'
  | 'html';

export interface DeliveryPackFileContract {
  path: string;
  filename: string;
  sectionId: DeliveryPackSectionId;
  kind: DeliveryPackFileKind;
  required: true;
}

export interface DeliveryPackSectionContract {
  id: DeliveryPackSectionId;
  folder: string;
  label: string;
  files: DeliveryPackFileContract[];
}

export interface DeliveryPackManifest {
  product: 'ShipSeal';
  packNameTemplate: 'shipseal-delivery-pack-[project]';
  version: 1;
  sections: DeliveryPackSectionContract[];
  rootFiles: DeliveryPackFileContract[];
}

export interface DeliveryPackGeneratedFile {
  path: string;
  content: string;
  kind: DeliveryPackFileKind;
}
