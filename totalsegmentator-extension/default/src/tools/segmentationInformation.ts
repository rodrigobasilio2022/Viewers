import {
  cache,
  Types,
  StackViewport,
  VolumeViewport,
} from '@cornerstonejs/core';

import {
  Types as csToolsTypes,
  Enums,
  ToolGroupManager,
  segmentation as Segmentation,
} from '@cornerstonejs/tools';

class SegmentationInformation {
  toolGroupId;
  segmentationId;
  constructor(toolGroupId) {
    this.toolGroupId = toolGroupId;
    this.segmentationId = undefined;
  }

  /**
   * Checks if a series displayed in a given viewport the reference
   * series for a segmentation
   * @param segmentationId
   * @param viewportVolumeId
   * @returns
   */
  isSegmentationReferencedVolumeFor(segmentationId, viewportVolumeId) {
    if (!segmentationId || !viewportVolumeId) {
      return false;
    }
    const segmentation = Segmentation.state.getSegmentation(segmentationId);
    if (!segmentation) {
      return false;
    }
    const labelmapData =
      segmentation?.representationData[
        Enums.SegmentationRepresentations.Labelmap
      ];
    return labelmapData?.referencedVolumeId === viewportVolumeId;
  }

  /**
   * This function updates the internal segmentationId information with the one
   * associated to a given viewport, if any
   * @param viewport
   */
  updateSegmentationIdWith(viewport) {
    // for now a segmentation is opened in volume viewport only
    let segmentationId;
    if (viewport instanceof VolumeViewport) {
      const segmentationIdList = this.getSegmentationIdList();
      const baseActor = viewport.getDefaultActor();
      if (baseActor && segmentationIdList.length > 0) {
        const actors = viewport.getActors();
        for (let i = 0; i < actors.length; i++) {
          const actor = actors[i];
          if (actor !== baseActor) {
            if (segmentationIdList.includes(actor?.referenceId)) {
              if (
                this.isSegmentationReferencedVolumeFor(
                  actor?.referenceId,
                  baseActor?.referenceId
                )
              ) {
                segmentationId = actor?.referenceId;
                break;
              }
            }
          }
        }
      }
    }
    this.segmentationId = segmentationId;
    return segmentationId;
  }

  /**
   * This function gets the labelmap segmentation representation associated to
   * a segmentationId
   * @param segmentationId id of the segmentation
   * @returns
   */
  getSegmentationRepresentation(
    segmentationId?: string
  ): csToolsTypes.ToolGroupSpecificLabelmapRepresentation | undefined {
    const toolGroupSegmentationRepresentations = this.getSegmentationRepresentations();

    if (
      !toolGroupSegmentationRepresentations ||
      toolGroupSegmentationRepresentations.length === 0
    ) {
      return undefined;
    }
    const representation = toolGroupSegmentationRepresentations.find(
      (representation: csToolsTypes.ToolGroupSpecificRepresentation) => {
        if (
          representation.type === Enums.SegmentationRepresentations.Labelmap
        ) {
          // if segmentationId is given, try to find the correspondent representation
          if (segmentationId) {
            return representation.segmentationId === segmentationId;
          } else {
            // if segmentationId is not given, get the first one available
            return true;
          }
        }
        // we are only using labelMap representations
        return false;
      }
    );
    return representation;
  }

  /**
   * Get the id list of the segmentations currently loaded in the system
   * @returns
   */
  getSegmentationIdList() {
    const toolGroupSegmentationRepresentations = this.getSegmentationRepresentations();
    const segmentationIdList = [];
    if (
      !toolGroupSegmentationRepresentations ||
      toolGroupSegmentationRepresentations.length === 0
    ) {
      return segmentationIdList;
    }

    toolGroupSegmentationRepresentations.forEach(
      (representation: csToolsTypes.ToolGroupSpecificRepresentation) => {
        if (
          representation.type === Enums.SegmentationRepresentations.Labelmap
        ) {
          segmentationIdList.push(representation.segmentationId);
        }
      }
    );
    return segmentationIdList;
  }
  /**
   * This function gets the color LUT of the segmentationId associated to this
   * tool
   */
  getColorLUT(): void {
    if (this.segmentationId) {
      if (!this.colorLUT) {
        const representation = this.getSegmentationRepresentation(
          this.segmentationId
        );
        this.colorLUT = Segmentation.state.getColorLUT(
          representation.colorLUTIndex
        );
      }
    }
  }

  getSegmentationLabelInCanvas(viewport, canvasPos): string | undefined {
    if (!this.segmentationId) {
      this.updateSegmentationIdWith(viewport);
    }
    if (this.segmentationId) {
      const segmentationVolume = cache.getVolume(this.segmentationId);
      const [rows, columns, slices] = segmentationVolume.dimensions;

      if (!segmentationVolume) return;
      const worldCoords = viewport.canvasToWorld(canvasPos);
      const indexCoords = segmentationVolume.imageData?.worldToIndex(
        worldCoords
      );
      if (indexCoords) {
        const sliceOffset = columns * rows * Math.floor(indexCoords[2]);
        const offset =
          sliceOffset +
          Math.floor(indexCoords[1]) * columns +
          Math.floor(indexCoords[0]);
        const segmentationScalarData = segmentationVolume.getScalarData();
        const segmentIndex = segmentationScalarData[offset];
        return this.getSegmentLabel(segmentIndex);
      }
      return;
    }
  }
  /**
   * This function gets the segment label associated to a given segmentIndex
   */
  getSegmentLabel(segmentIndex: number): string {
    const segmentation = Segmentation.state.getSegmentation(
      this.segmentationId
    );
    return segmentation.segmentLabels[segmentIndex];
  }

  /**
   * This function gets the color string of a segment
   * @param segmentIndex the segment index
   * @returns color string
   */
  getSegmentColor(segmentIndex: number): string {
    let colorString = '';
    this.getColorLUT();
    if (this.colorLUT) {
      const color = this.colorLUT[segmentIndex];
      colorString = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }
    return colorString;
  }

  /**
   * This function get the visibility of a segment. In the current CS3D
   * implementation, a segment is visible if it is not hidden, if it doesn't
   * belong to the segmentsHidden list. This visibility coding scheme consider
   * visible any invalid segmentIndex, like negative values and values greater
   * than segmentsCount, as they will never belong to the list.  We have another
   * public function isSegmentVisible that checks if the segment is not hidden
   * and valid.
   * @param segmentIndex the segment index
   * @returns The visibility of the segment
   */
  private getSegmentVisibility(segmentIndex: number): boolean {
    if (this.segmentationId !== '') {
      const representation = this.getSegmentationRepresentation(
        this.segmentationId
      );
      return !representation.segmentsHidden.has(segmentIndex);
    } else {
      return false;
    }
  }

  /**
   * Returns if a segment has a position in a particular slice and if is visible
   * @param slice slice to display
   * @param segmentIndex segment index
   * @returns
   */
  isSegmentVisible(slice: number, segmentIndex: number): boolean {
    return this.getSegmentVisibility(segmentIndex);
  }
  /**
   * This function gets the segment representations for the toolGroupId of this
   * tool and returns a list of labelmap representations
   * @returns List of labelmap representations
   */
  getSegmentationRepresentations() {
    const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);

    if (!toolGroup) {
      return;
    }
    const toolGroupSegmentationRepresentations = Segmentation.state.getSegmentationRepresentations(
      this.toolGroupId
    );
    return toolGroupSegmentationRepresentations;
  }
}

export default function getSegmentLabelFromCanvas(
  viewport: StackViewport | VolumeViewport,
  toolGroupId: string,
  canvasPos: number[],
  segInfoObj?: SegmentationInformation
): string | undefined {
  let usedSegInfoObj = segInfoObj;
  if (!segInfoObj) {
    usedSegInfoObj = new SegmentationInformation(toolGroupId);
  }
  return usedSegInfoObj?.getSegmentationLabelInCanvas(viewport, canvasPos);
}
