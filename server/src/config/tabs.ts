// Configuración de pestañas de la agenda
// Este archivo permite configurar fácilmente las pestañas sin modificar la base de datos

export interface TabConfig {
  id: number;
  name: string;
  order: number;
}

export const TABS_CONFIG: Omit<TabConfig, 'id'>[] = [
  { name: 'Apertura', order: 1 },
  { name: 'Tema 1 - Planeación Conjunta', order: 2 },
  { name: 'Tema 2 - Logística Operacional', order: 3 },
  { name: 'Tema 3 - Derechos Humanos', order: 4 },
  { name: 'Tema 4 - Pensamiento Estratégico', order: 5 },
  { name: 'Documentos de Apoyo', order: 6 },
  { name: 'Directorio', order: 7 }
];
