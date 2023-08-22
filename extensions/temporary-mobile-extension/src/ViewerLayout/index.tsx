import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import {
  SidePanel,
  ErrorBoundary,
  UserPreferences,
  AboutModal,
  useModal,
  LoadingIndicatorProgress,
  useCine,
  Dialog,
} from '@ohif/ui';
import i18n from '@ohif/i18n';
import {
  ServicesManager,
  HangingProtocolService,
  hotkeys,
  CommandsManager,
} from '@ohif/core';
import { useAppConfig } from '@state';
import { Toolbar } from '@ohif/extension-default';
import Header from './Header';

//const { availableLanguages, defaultLanguage, currentLanguage } = i18n;

function ViewerLayout({
  // From Extension Module Params
  extensionManager,
  servicesManager,
  hotkeysManager,
  commandsManager,
  // From Modes
  viewports,
  ViewportGridComp,
  leftPanels = [],
  rightPanels = [],
  leftPanelDefaultClosed = window?.config?.leftPanelDefaultClosed,
  rightPanelDefaultClosed = true,
}): React.FunctionComponent {
  const [appConfig] = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const onClickReturnButton = () => {
    commandsManager.runCommand('executeNavigation', {
      commandsManager,
      servicesManager,
      navigate,
      location,
    });
  };

  const { t } = useTranslation();
  const { show, hide } = useModal();

  const [showLoadingIndicator, setShowLoadingIndicator] = useState(
    appConfig.showLoadingIndicator
  );

  const { hangingProtocolService } = servicesManager.services;

  const { hotkeyDefinitions, hotkeyDefaults } = hotkeysManager;
  const versionNumber = process.env.VERSION_NUMBER;
  const buildNumber = process.env.BUILD_NUM;

  const openPreferences = () => {
    show({
      title: t('UserPreferencesModal:User Preferences'),
      content: UserPreferences,
      contentProps: {
        hotkeyDefaults: hotkeysManager.getValidHotkeyDefinitions(
          hotkeyDefaults
        ),
        hotkeyDefinitions,
        currentLanguage: currentLanguage(),
        availableLanguages,
        defaultLanguage,
        onCancel: () => {
          hotkeys.stopRecord();
          hotkeys.unpause();
          hide();
        },
        onSubmit: ({ hotkeyDefinitions, language }) => {
          i18n.changeLanguage(language.value);
          hotkeysManager.setHotkeys(hotkeyDefinitions);
          hide();
        },
        onReset: () => hotkeysManager.restoreDefaultBindings(),
        hotkeysModule: hotkeys,
      },
    });
  };

  const menuOptions = [];

  window?.parent?.postMessage({ msg: 'show-preferences' }, '*');

  if (appConfig.oidc) {
    menuOptions.push({
      title: t('Header:Logout'),
      icon: 'power-off',
      onClick: async () => {
        navigate(
          `/logout?redirect_uri=${encodeURIComponent(window.location.href)}`
        );
      },
    });
  }

  /**
   * Set body classes (tailwindcss) that don't allow vertical
   * or horizontal overflow (no scrolling). Also guarantee window
   * is sized to our viewport.
   */
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('overflow-hidden');

    function onMessage(event) {
      return;
      switch (event?.data?.msg) {
        case 'flexviewOpenPreferences': {
          openPreferences();
        }
      }
    }
    window.addEventListener('message', onMessage, false);
    return () => {
      window.removeEventListener('message', onMessage, false);
      document.body.classList.remove('bg-black');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const getComponent = id => {
    const entry = extensionManager.getModuleEntry(id);

    if (!entry) {
      throw new Error(
        `${id} is not a valid entry for an extension module, please check your configuration or make sure the extension is registered.`
      );
    }

    let content;
    if (entry && entry.component) {
      content = entry.component;
    } else {
      throw new Error(
        `No component found from extension ${id}. Check the reference string to the extension in your Mode configuration`
      );
    }

    return { entry, content };
  };

  const getPanelData = id => {
    const { content, entry } = getComponent(id);

    return {
      id: entry.id,
      iconName: entry.iconName,
      iconLabel: entry.iconLabel,
      label: entry.label,
      name: entry.name,
      content,
    };
  };

  useEffect(() => {
    const { unsubscribe } = hangingProtocolService.subscribe(
      HangingProtocolService.EVENTS.PROTOCOL_CHANGED,

      // Todo: right now to set the loading indicator to false, we need to wait for the
      // hangingProtocolService to finish applying the viewport matching to each viewport,
      // however, this might not be the only approach to set the loading indicator to false. we need to explore this further.
      () => {
        setShowLoadingIndicator(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [hangingProtocolService]);

  const getViewportComponentData = viewportComponent => {
    const { entry } = getComponent(viewportComponent.namespace);

    return {
      component: entry.component,
      displaySetsToDisplay: viewportComponent.displaySetsToDisplay,
    };
  };

  const leftPanelComponents = leftPanels.map(getPanelData);
  const rightPanelComponents = rightPanels.map(getPanelData);
  const viewportComponents = viewports.map(getViewportComponentData);

  // activate panel automatically when segmentations or measurements are present
  const {
    panelService,
    measurementService,
    segmentationService,
  } = servicesManager.services;

  panelService.addActivatePanelTriggers(
    '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentation',
    [
      {
        sourcePubSubService: segmentationService,
        sourceEvents: [
          segmentationService.EVENTS.SEGMENTATION_LOADING_COMPLETE,
        ],
      },
    ]
  );
  panelService.addActivatePanelTriggers(
    '@ohif/extension-default.panelModule.measure',
    [
      {
        sourcePubSubService: measurementService,
        sourceEvents: [
          measurementService.EVENTS.MEASUREMENT_ADDED,
          measurementService.EVENTS.RAW_MEASUREMENT_ADDED,
        ],
      },
    ]
  );

  // reset CINE AB#228
  const [state, api] = useCine();

  useEffect(() => {
    api.setIsCineEnabled(false);
  }, []);

  return (
    <div>
      <Header
        menuOptions={menuOptions}
        isReturnEnabled={!!appConfig.showStudyList}
        onClickReturnButton={onClickReturnButton}
        whiteLabeling={appConfig.whiteLabeling}
        servicesManager={servicesManager}
        isReturnEnabled={!!appConfig.showStudyList}
      >
        <ErrorBoundary context="Primary Toolbar">
          <div className="relative flex justify-center">
            <Toolbar servicesManager={servicesManager} />
          </div>
        </ErrorBoundary>
      </Header>
      <div
        className="bg-black flex flex-row items-stretch w-full overflow-hidden flex-nowrap relative"
        style={{ height: 'calc(100vh - 60px' }}
      >
        <React.Fragment>
          {showLoadingIndicator && (
            <LoadingIndicatorProgress className="h-full w-full bg-black" />
          )}
          {/* LEFT SIDEPANELS */}
          {leftPanelComponents.length ? (
            <ErrorBoundary context="Left Panel">
              <SidePanel
                side="left"
                activeTabIndex={leftPanelDefaultClosed ? null : 0}
                tabs={leftPanelComponents}
                servicesManager={servicesManager}
              />
            </ErrorBoundary>
          ) : null}
          {/* TOOLBAR + GRID */}
          <div className="flex flex-col flex-1 h-full">
            <div className="flex items-center justify-center flex-1 h-full overflow-hidden bg-black relative">
              <ErrorBoundary context="Grid">
                <ViewportGridComp
                  servicesManager={servicesManager}
                  viewportComponents={viewportComponents}
                  commandsManager={commandsManager}
                />
              </ErrorBoundary>
            </div>
          </div>
          {rightPanelComponents.length ? (
            <ErrorBoundary context="Right Panel">
              <SidePanel
                side="right"
                activeTabIndex={rightPanelDefaultClosed ? null : 0}
                tabs={rightPanelComponents}
                servicesManager={servicesManager}
              />
            </ErrorBoundary>
          ) : null}
        </React.Fragment>
      </div>
    </div>
  );
}

ViewerLayout.propTypes = {
  // From extension module params
  extensionManager: PropTypes.shape({
    getModuleEntry: PropTypes.func.isRequired,
  }).isRequired,
  commandsManager: PropTypes.instanceOf(CommandsManager),
  servicesManager: PropTypes.instanceOf(ServicesManager),
  // From modes
  leftPanels: PropTypes.array,
  rightPanels: PropTypes.array,
  leftPanelDefaultClosed: PropTypes.bool.isRequired,
  rightPanelDefaultClosed: PropTypes.bool.isRequired,
  /** Responsible for rendering our grid of viewports; provided by consuming application */
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
};

export default ViewerLayout;
