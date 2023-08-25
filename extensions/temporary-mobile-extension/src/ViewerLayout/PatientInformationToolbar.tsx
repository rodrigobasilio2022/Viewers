const React = window.sharedLibraries['react'];
const { useEffect, useState } = React;
const { utils } = window.sharedLibraries['@ohif/core'];
const { useViewportGrid } = window.sharedLibraries['@ohif/ui'];

export default function OHIFCornerstoneSEGViewport(props) {
  const { servicesManager } = props;
  const { DisplaySetService: displaySetService } = servicesManager.services;
  const [viewportGrid] = useViewportGrid();
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');

  useEffect(() => {
    const { activeViewportIndex, viewports } = viewportGrid;

    const activeViewportSpecificData = viewports[activeViewportIndex];
    if (!activeViewportSpecificData) return;
    const { displaySetInstanceUIDs } = activeViewportSpecificData;
    if (!displaySetInstanceUIDs?.length) return;
    const displaySetUid = displaySetInstanceUIDs[0];

    const displaySet = displaySetService.getDisplaySetByUID(displaySetUid);
    if (!displaySet) return;
    const instance =
      displaySet.instance ||
      displaySet.images?.[0] ||
      displaySet.instances?.[0] ||
      displaySet.other?.[0];
    if (!instance) return;
    setPatientName(utils.formatPN(instance.PatientName));
    setPatientId(instance.PatientID);
  }, [viewportGrid, displaySetService]);

  return (
    <div className="ml-60 text-white">
      <p className="text-white text-">{patientName}</p>
      <p className="text-aqua-secondary">{patientId}</p>
    </div>
  );
}
