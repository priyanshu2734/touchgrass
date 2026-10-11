import { BARRIERS } from '../../data/barriers';
import type { BarrierId } from '../../types';
import { CheckChips } from '../ChoiceChips';

interface Props {
  name: string;
  values: BarrierId[];
  onChange: (values: BarrierId[]) => void;
  describedBy?: string;
}

export function BarrierChips({ name, values, onChange, describedBy }: Props) {
  return (
    <CheckChips
      name={name}
      options={BARRIERS.map((b) => ({ value: b.id, label: b.label, icon: b.icon }))}
      values={values}
      onChange={onChange}
      describedBy={describedBy}
    />
  );
}
