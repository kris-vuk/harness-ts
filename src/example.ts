import { CustomStage } from "./constructs/custom-stage.js";
import { Pipeline } from "./constructs/pipeline.js";
import { WaitStep } from "./constructs/wait-step.js";

const pipeline = new Pipeline({name: "pipeline", projectIdentifier: ""})

const customStage = new CustomStage({
    name: "CustomStage"
})

customStage.addStep(new WaitStep({name: "BakeTime", duration: "1000"}))

pipeline.addStage(customStage)

pipeline.synth()