import {
  getEnabledElementByIds,
  VolumeViewport,
  StackViewport,
  utilities as csUtils,
} from '@cornerstonejs/core';
import {
  BaseTool,
  utilities as cstUtils,
  Types
} from '@cornerstonejs/tools';

const minShift = 10;
/**
 * The StackScrollTool is a tool that allows the user to scroll through a
 * stack of images by pressing the mouse click and dragging
 */
class StackScrollMobileTool extends BaseTool {
  static toolName;
  deltaY: number;
  mouseReleased: boolean;
  initialMousePos;
  constructor(
    toolProps: Types.PublicToolProps = {},
    defaultToolProps: Types.ToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        lrChangeCallback: (deltaXOffset) => {},
        invert: false,
        debounceIfNotLoaded: true,
        loop: false,
      },
    }
  ) {
    super(toolProps, defaultToolProps);
    this.deltaY = 1;
  }

  mouseDragCallback(evt: Types.EventTypes.InteractionEventType) {
    this._dragCallback(evt);
  }
  touchDragCallback(evt: Types.EventTypes.InteractionEventType) {
    this._dragCallback(evt);
  }


  _dragCallback(evt: Types.EventTypes.InteractionEventType) {
    const { deltaPoints, viewportId, renderingEngineId, currentPoints } = evt.detail;
    const { viewport } = getEnabledElementByIds(viewportId, renderingEngineId);

    const targetId = this.getTargetId(viewport);
    const { debounceIfNotLoaded, invert, loop } = this.configuration;

    if (!this.initialMousePos) {
      this.initialMousePos = currentPoints.canvas;
    }
    const deltaXOffset = currentPoints.canvas[0] - this.initialMousePos[0];
    const deltaPointY = deltaPoints.canvas[1];

    let volumeId;
    if (viewport instanceof VolumeViewport) {
      volumeId = targetId.split('volumeId:')[1];
    }

    const pixelsPerImage = this._getPixelPerImage(viewport);
    const deltaY = deltaPointY + this.deltaY;

    if (!pixelsPerImage) {
      return;
    }

    if (Math.abs(deltaY) >= pixelsPerImage) {
      const imageIdIndexOffset = Math.round(deltaY / pixelsPerImage);

      cstUtils.scroll(viewport, {
        delta: invert ? -imageIdIndexOffset : imageIdIndexOffset,
        volumeId,
        debounceLoading: debounceIfNotLoaded,
        loop: loop,
      });

      this.deltaY = deltaY % pixelsPerImage;
    } else {
      this.deltaY = deltaY;
    }

    if (Math.abs(deltaXOffset) > minShift) {
        if (this.configuration.lrChangeCallback) {
          this.configuration.lrChangeCallback(deltaXOffset);
        }
        this.initialMousePos = undefined;
    }
  }

  _getPixelPerImage(viewport) {
    const { element } = viewport;
    const numberOfSlices = this._getNumberOfSlices(viewport);

    // The Math.max here makes it easier to mouseDrag-scroll small or really large image stacks
    return Math.max(2, element.offsetHeight / Math.max(numberOfSlices, 8));
  }

  _getNumberOfSlices(viewport) {
    if (viewport instanceof VolumeViewport) {
      const { numberOfSlices } =
        csUtils.getImageSliceDataForVolumeViewport(viewport);
      return numberOfSlices;
    } else if (viewport instanceof StackViewport) {
      return viewport.getImageIds().length;
    }
  }
}

StackScrollMobileTool.toolName = 'StackScrollMobile';
export default StackScrollMobileTool;
