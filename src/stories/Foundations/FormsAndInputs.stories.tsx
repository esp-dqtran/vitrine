import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CheckboxInput,
  Icon,
  RadioList,
  RadioListItem,
  Switch,
  TextArea,
  TextInput,
} from '@astryxdesign/core';
import './FormsAndInputs.css';

const meta = {
  title: 'Foundations/Forms and inputs',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The approved shared Vitrines form controls, applied to editable product fields while specialized editor and canvas geometry remains domain-owned.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ReviewSection({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="forms-review__section">
      <header className="forms-review__section-header">
        <span className="forms-review__section-index">{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function StateCard({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <article className="forms-review__state-card">
      <div className="forms-review__state-copy">
        <strong>{name}</strong>
        <span>{note}</span>
      </div>
      {children}
    </article>
  );
}

function AppsPilot() {
  const [headerQuery, setHeaderQuery] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(['AI', 'Business']);
  const categories = ['AI', 'Business', 'CRM', 'Finance', 'News'];
  const visibleCategories = categories.filter((category) =>
    category.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  const toggleCategory = (category: string, checked: boolean | 'indeterminate') => {
    setSelected((current) =>
      checked === true
        ? Array.from(new Set([...current, category]))
        : current.filter((item) => item !== category),
    );
  };

  return (
    <div className="forms-review__pilot-grid">
      <article className="forms-review__pilot-card forms-review__pilot-card--wide">
        <div className="forms-review__pilot-label">
          <span>Header search</span>
          <small>Apps pilot</small>
        </div>
        <TextInput
          className="forms-review__product-input"
          label="Search Apps"
          isLabelHidden
          value={headerQuery}
          onChange={setHeaderQuery}
          placeholder="Search Apps…"
          startIcon={<Icon icon="search" size="sm" />}
          hasClear
          width="100%"
        />
        <p className="forms-review__hint">
          One shared field treatment for the persistent navigation and compact layouts.
        </p>
      </article>

      <article className="forms-review__pilot-card">
        <div className="forms-review__pilot-label">
          <span>Filter search</span>
          <small>Categories</small>
        </div>
        <TextInput
          className="forms-review__product-input"
          label="Search categories"
          isLabelHidden
          value={filterQuery}
          onChange={setFilterQuery}
          placeholder="Search categories…"
          startIcon={<Icon icon="search" size="sm" />}
          hasClear
          width="100%"
        />
        <div className="forms-review__checkbox-list">
          {visibleCategories.map((category) => (
            <CheckboxInput
              key={category}
              label={category}
              value={selected.includes(category)}
              onChange={(checked) => toggleCategory(category, checked)}
              size="sm"
              width="100%"
            />
          ))}
        </div>
      </article>

      <article className="forms-review__pilot-card">
        <div className="forms-review__pilot-label">
          <span>Selection summary</span>
          <small>{selected.length} selected</small>
        </div>
        <div className="forms-review__selection-summary">
          {selected.length ? (
            selected.map((category) => <span key={category}>{category}</span>)
          ) : (
            <p>No categories selected</p>
          )}
        </div>
        <p className="forms-review__hint">
          Search and selection remain independent, predictable, and reversible.
        </p>
      </article>
    </div>
  );
}

function InputStates() {
  const [defaultValue, setDefaultValue] = useState('');
  const [filledValue, setFilledValue] = useState('Aboard');

  return (
    <div className="forms-review__state-grid">
      <StateCard name="Default" note="Empty and ready for input">
        <TextInput
          className="forms-review__product-input"
          label="App name"
          value={defaultValue}
          onChange={setDefaultValue}
          placeholder="Enter an app name"
          width="100%"
        />
      </StateCard>
      <StateCard name="Filled" note="Editable value with clear action">
        <TextInput
          className="forms-review__product-input"
          label="App name"
          value={filledValue}
          onChange={setFilledValue}
          hasClear
          width="100%"
        />
      </StateCard>
      <StateCard name="Success" note="Confirmed without overpowering the field">
        <TextInput
          className="forms-review__product-input"
          label="Website"
          value="https://aboard.com"
          onChange={() => {}}
          status={{ type: 'success', message: 'Website verified' }}
          width="100%"
        />
      </StateCard>
      <StateCard name="Error" note="Specific recovery message near the field">
        <TextInput
          className="forms-review__product-input"
          label="Email"
          type="email"
          value="admin@"
          onChange={() => {}}
          status={{ type: 'error', message: 'Enter a complete email address' }}
          width="100%"
        />
      </StateCard>
      <StateCard name="Disabled" note="Unavailable and visibly lower emphasis">
        <TextInput
          className="forms-review__product-input"
          label="Workspace ID"
          value="aboard-prod"
          onChange={() => {}}
          isDisabled
          disabledMessage="Workspace IDs cannot be changed"
          width="100%"
        />
      </StateCard>
      <StateCard name="Focus" note="Click or tab here to inspect the focus ring">
        <TextInput
          className="forms-review__product-input"
          label="Search focus"
          value=""
          onChange={() => {}}
          placeholder="Press Tab or click"
          startIcon={<Icon icon="search" size="sm" />}
          width="100%"
        />
      </StateCard>
    </div>
  );
}

function ExtendedControls() {
  const [description, setDescription] = useState(
    'Bring all your people data into one place and turn it into useful answers.',
  );
  const [platform, setPlatform] = useState('web');
  const [notifications, setNotifications] = useState(true);
  const [beta, setBeta] = useState(false);

  return (
    <div className="forms-review__extended-grid">
      <article className="forms-review__control-card forms-review__control-card--textarea">
        <div className="forms-review__control-copy">
          <strong>Textarea</strong>
          <span>Descriptions and longer notes</span>
        </div>
        <TextArea
          label="App description"
          description="Keep the summary concise and product-focused."
          value={description}
          onChange={setDescription}
          rows={3}
          maxLength={180}
          width="100%"
        />
      </article>

      <article className="forms-review__control-card">
        <div className="forms-review__control-copy">
          <strong>Radio group</strong>
          <span>Choose one visible option</span>
        </div>
        <RadioList
          label="Default platform"
          description="Used when every option should remain visible."
          value={platform}
          onChange={setPlatform}
          size="sm"
          width="100%"
        >
          <RadioListItem label="Web" value="web" />
          <RadioListItem label="iOS" value="ios" />
          <RadioListItem label="Android" value="android" />
        </RadioList>
      </article>

      <article className="forms-review__control-card">
        <div className="forms-review__control-copy">
          <strong>Switches</strong>
          <span>Immediate on or off settings</span>
        </div>
        <div className="forms-review__switch-list">
          <Switch
            label="Analysis updates"
            description="Notify me when analysis completes."
            value={notifications}
            onChange={setNotifications}
            labelSpacing="spread"
            width="100%"
          />
          <Switch
            label="Beta features"
            description="Try unfinished product features."
            value={beta}
            onChange={setBeta}
            labelSpacing="spread"
            width="100%"
          />
          <Switch
            label="Organization policy"
            value={false}
            onChange={() => {}}
            isDisabled
            disabledMessage="Managed by your organization"
            labelSpacing="spread"
            width="100%"
          />
        </div>
      </article>
    </div>
  );
}

function FormsAndInputsReview() {
  return (
    <main className="forms-review">
      <header className="forms-review__intro">
        <div>
          <p className="forms-review__eyebrow">Vitrines · Component system</p>
          <h1>Forms &amp; Inputs</h1>
          <p className="forms-review__lede">
            The approved shared control system used by editable Vitrines forms.
          </p>
        </div>
        <span className="forms-review__status">Approved standard · applied</span>
      </header>

      <ReviewSection
        index="01"
        title="Apps pilot"
        description="The Apps header Search control is the selected visual standard, rebuilt here as a real editable field."
      >
        <AppsPilot />
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Input states"
        description="The visual contract for default, filled, success, error, disabled, and focus behavior."
      >
        <InputStates />
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Extended controls"
        description="Textarea, radio, and switch patterns share the same state and accessibility contract across product screens."
      >
        <ExtendedControls />
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <FormsAndInputsReview />,
};
