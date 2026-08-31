import { scoreAnswer } from "../scoring";
import { buildChoiceRounds, CHOICE_COUNT } from "./rounds";
import type { BuildRoundsInput, GameMode, Judgement, JudgeInput, RoundPlan } from "./index";

export { CHOICE_COUNT };

/**
 * One clip, one answer, best speed wins.
 *
 * There are no stages here: the whole Round is a single tier and the bonus
 * falls off continuously with the clock, which is why `stagesMs` is empty.
 */
export const quizMode: GameMode = {
  id: "quiz",
  shared: false,

  buildRounds(input: BuildRoundsInput): RoundPlan[] {
    return buildChoiceRounds(input, (d) => ({
      clipMs: d.clipMs,
      answerWindowMs: d.answerWindowMs,
      stagesMs: [],
    }));
  },

  judge({ plan, choiceId, elapsedMs }: JudgeInput): Judgement {
    const correct = choiceId === plan.answer.id;
    return {
      correct,
      gained: scoreAnswer({
        correct,
        elapsedMs,
        windowMs: plan.answerWindowMs,
        multiplier: plan.multiplier,
      }),
      // Right or wrong, a Quiz answer is final. That is what makes the speed
      // bonus mean anything.
      final: true,
    };
  },
};
