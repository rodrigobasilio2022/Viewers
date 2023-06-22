import DeepLookTool from '../tools/deepLookTool';

const { addTool } =  window.sharedLibraries['@cornerstonejs/tools'];

const CORNERSTONE_3D_TOOLS_SOURCE_NAME = 'Cornerstone3DTools';
const CORNERSTONE_3D_TOOLS_SOURCE_VERSION = '0.1';

/**
 * Loads config point configuration from the
 * public/theme/<themeName> directory, as specified by the "theme" url parameter.
 *
 * @returns async result to load config point registration
 */
export default function preRegistration({ servicesManager }) {
  addTool(DeepLookTool);
}
