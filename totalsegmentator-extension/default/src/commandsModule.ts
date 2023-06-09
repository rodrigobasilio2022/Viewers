import dcmjs from 'dcmjs';
import { Types as OhifTypes } from '@ohif/core';
import { metaData, cache, StackViewport } from '@cornerstonejs/core';
import { DicomMetadataStore } from '@ohif/core';

const defaultContext = 'CORNERSTONE';

const commandsModule = ({
  servicesManager,
  commandsManager,
  extensionManager,
  appConfig,
}: OhifTypes.Extensions.ExtensionParams): OhifTypes.Extensions.CommandsModule => {
  const {
    viewportGridService,
    toolGroupService,
    cornerstoneViewportService,
    uiNotificationService,
    displaySetService,
  } = servicesManager.services;

  function getDicomWebClient() {
    const dataSourceConfig = window.config.dataSources.find(
      ds => ds.sourceName === extensionManager.activeDataSource
    );
    const { wadoRoot } = dataSourceConfig.configuration;
    const parts = wadoRoot.split('/');
    const dicomWebUrl = parts.slice(0, -1).join('/');
    const dicomWebSuffix = parts.slice(-1)[0];
    return { dicomWebUrl, dicomWebSuffix };
  }

  /**
   * Gets the imageIds list based on the type of the viewport
   * @param baseViewport
   */
  function getImageIds(baseViewport) {
    let imageIds;
    if (baseViewport instanceof StackViewport) {
      imageIds = baseViewport.getImageIds();
    } else {
      const defaultActor = baseViewport.getDefaultActor();
      if (defaultActor) {
        const { uid: defaultActorUID } = defaultActor;
        const volume = cache.getVolume(defaultActorUID);
        imageIds = volume.imageIds;
      }
    }
    return imageIds;
  }

  function messageStatus(isInfoMessage, message) {
    uiNotificationService.show({
      title: 'TotalSegmentator integration',
      message: message,
      type: isInfoMessage ? 'info' : 'error',
      duration: 2000,
    });
  }

  function getActiveViewport() {
    const { activeViewportIndex, viewports } = viewportGridService.getState();
    return {
      cornerstoneViewport: cornerstoneViewportService.getCornerstoneViewportByIndex(
        activeViewportIndex
      ),
      ohifViewport: viewports[activeViewportIndex],
    };
  }

  function getOrientation(viewport) {
    const normalVector = viewport.getCamera().viewPlaneNormal;
    let largestAxis = 0;
    for (let i = 1; i < normalVector.length; i++) {
      if (Math.abs(normalVector[i]) > Math.abs(normalVector[largestAxis])) {
        largestAxis = i;
      }
    }
    return largestAxis;
  }

  function getToolGroup() {
    const { ohifViewport: activeViewport } = getActiveViewport();
    return toolGroupService.getToolGroupForViewport(activeViewport.viewportId);
  }
  function getConnectionInfo() {
    const { cornerstoneViewport: activeViewport } = getActiveViewport();
    const imageIds = getImageIds(activeViewport);
    if (imageIds.length) {
      const { StudyInstanceUID, SeriesInstanceUID } = metaData.get(
        'instance',
        imageIds[0]
      );
      const { dicomWebUrl, dicomWebSuffix } = getDicomWebClient();
      return {
        dicomWebUrl,
        dicomWebSuffix,
        StudyInstanceUID,
        SeriesInstanceUID,
      };
    }
    return;
  }

  function sendRequest({
    dicomWebUrl,
    dicomWebSuffix,
    StudyInstanceUID,
    SeriesInstanceUID,
  }) {
    const data = new FormData();
    data.append('server', dicomWebUrl);
    data.append('suffix', dicomWebSuffix);
    data.append('studyUID', StudyInstanceUID);
    data.append('seriesUID', SeriesInstanceUID);
    fetch('http://localhost:9000/processSeries', {
      method: 'POST',
      body: data,
    }).then(res => {
      if (res.status === 200) {
        const info = {
          dicomWebUrl,
          dicomWebSuffix,
          StudyInstanceUID,
          SeriesInstanceUID,
        };
        getResult(info);
      }
    });
  }

  function getResult({
    dicomWebUrl,
    dicomWebSuffix,
    StudyInstanceUID,
    SeriesInstanceUID,
  }) {
    const data = new FormData();
    data.append('server', dicomWebUrl);
    data.append('suffix', dicomWebSuffix);
    data.append('studyUID', StudyInstanceUID);
    data.append('seriesUID', SeriesInstanceUID);
    fetch('http://localhost:9000/downloadSegmentation', {
      method: 'POST',
      body: data,
    })
      .then(res => res.arrayBuffer())
      .then(res => {
        const dicomData = dcmjs.data.DicomMessage.readFile(res);
        const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
          dicomData.dict
        );
        dataset.segArrayBuffer = res;
        DicomMetadataStore.addInstances([dataset], true);
      });
  }

  const actions = {
    sendToProcess() {
      const info = getConnectionInfo();
      if (info) {
        sendRequest(info);
      }
    },
    downloadResult() {
      const info = getConnectionInfo();
      if (info) {
        getResult(info);
      }
    },
  };

  const definitions = {
    sendToProcess: {
      commandFn: actions.sendToProcess,
    },
  };
  return { actions, defaultContext, definitions };
};

export default commandsModule;
