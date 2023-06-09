import { addTool } from '@cornerstonejs/tools';
import SegmentProbeTool from '../tools/SegmentProbeTool';

export default function preRegistration({ servicesManager }) {
  addTool(SegmentProbeTool);
}
