import React from 'react';
import { ImportModelDialog, ImportRepairReportDialog, ImportSketchDialog, SketchDimensionDialog } from './WorkspacePanels.jsx';
import { ParametersDialog, PlanePicker, SketchPalette } from './WorkspaceSketchUi.jsx';

export function WorkspaceDialogStack({ state, actions }) {
  const {
    activeSketchId,
    command,
    document,
    importDraft,
    importRepairReport,
    resumableSketchesByPlane,
    sketchImportDraft,
    sketchOptions,
  } = state;
  return (
    <>
      {command?.type === 'plane' && <PlanePicker variant="canvas" existingSketchesByPlane={resumableSketchesByPlane} onPick={actions.pickPlane} onCancel={actions.cancelPlane} />}
      <ImportModelDialog draft={importDraft} onChange={actions.changeModelImport} onConfirm={actions.confirmModelImport} onCancel={actions.cancelModelImport} />
      <ImportSketchDialog draft={sketchImportDraft} onChange={actions.changeSketchImport} onConfirm={actions.confirmSketchImport} onCancel={actions.cancelSketchImport} />
      <ImportRepairReportDialog report={importRepairReport} onSave={actions.saveImportReport} onClose={actions.closeImportReport} />
      <SketchDimensionDialog command={command} onChange={actions.updateCommand} onConfirm={actions.confirmSketchDimension} onCancel={actions.cancelCommand} />
      {command?.type === 'parameters' && <ParametersDialog document={document} commit={actions.commit} onClose={actions.cancelCommand} />}
      {activeSketchId && <SketchPalette options={sketchOptions} onChange={actions.changeSketchOption} onFinish={actions.finishSketch} />}
    </>
  );
}
