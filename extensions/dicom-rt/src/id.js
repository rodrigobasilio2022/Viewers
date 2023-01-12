import packageJson from '../package.json';

const id = packageJson.name;
const SOPClassHandlerName = 'dicom-rtss';
const SOPClassHandlerId = `${id}.sopClassHandlerModule.${SOPClassHandlerName}`;

export { id, SOPClassHandlerId, SOPClassHandlerName };
