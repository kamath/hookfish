import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { withTheme } from '@rjsf/core'
import type { ThemeProps } from '@rjsf/core'
import {
  ADDITIONAL_PROPERTY_FLAG,
  ariaDescribedByIds,
  enumOptionSelectedValue,
  enumOptionValueDecoder,
  enumOptionValueEncoder,
  examplesId,
  getInputProps,
  getOptionValueFormat,
  getSubmitButtonOptions,
  getTemplate,
  getUiOptions,
  labelValue,
  schemaRequiresTrueValue,
  titleId,
  descriptionId,
  errorId,
  buttonId,
  canExpand,
} from '@rjsf/utils'
import type {
  ArrayFieldItemTemplateProps,
  ArrayFieldTemplateProps,
  DescriptionFieldProps,
  FieldErrorProps,
  FieldHelpProps,
  FieldTemplateProps,
  IconButtonProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  SubmitButtonProps,
  TitleFieldProps,
  WidgetProps,
  WrapIfAdditionalTemplateProps,
} from '@rjsf/utils'
import { ghostButtonClass, inputClass, labelClass, typeClass } from '../lib/ui'

function isNestSchema(schema: RJSFSchema | undefined): boolean {
  if (!schema) {
    return false
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  if (types.includes('object') || schema.properties || schema.additionalProperties) {
    return true
  }
  if (types.includes('array')) {
    return true
  }
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    return true
  }
  return false
}

function NavGroup({
  id,
  title,
  required,
  extra,
  children,
}: {
  id: string
  title: string
  required?: boolean
  extra?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <fieldset
      id={id}
      data-oc-nav="group"
      data-oc-collapsed={open ? undefined : 'true'}
      className="min-w-0 border-0 p-0"
    >
      <legend className="mb-3 w-full px-0">
        <span className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            data-oc-toggle
            aria-expanded={open}
            className="flex min-h-11 items-baseline gap-2 text-left text-xs text-mute"
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? '−' : '+'}</span>
            <span>{title}</span>
            {required ? (
              <span className="text-signal" aria-hidden="true">
                *
              </span>
            ) : null}
          </button>
          {extra}
        </span>
      </legend>
      {open ? children : null}
    </fieldset>
  )
}

function schemaTypeLabel(schema: RJSFSchema | undefined): string {
  if (!schema) {
    return ''
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum
      .slice(0, 4)
      .map((value) => JSON.stringify(value))
      .join(' | ')
  }

  if (schema.items && !Array.isArray(schema.items)) {
    const items = schemaTypeLabel(schema.items as RJSFSchema)
    return items ? `${items}[]` : 'array'
  }

  if (Array.isArray(schema.type)) {
    return schema.type.filter((value) => value !== 'null').join(' | ')
  }

  if (typeof schema.type === 'string') {
    return schema.type
  }

  if (schema.properties || schema.$ref) {
    return typeof schema.title === 'string' ? schema.title : 'object'
  }

  return ''
}

function BaseInputTemplate(props: WidgetProps) {
  const {
    id,
    htmlName,
    value,
    readonly,
    disabled,
    autofocus,
    onBlur,
    onFocus,
    onChange,
    onChangeOverride,
    options,
    schema,
    rawErrors,
    type,
    hideLabel: _hideLabel,
    hideError: _hideError,
    name: _name,
    uiSchema: _uiSchema,
    registry: _registry,
    ...rest
  } = props

  const inputProps = {
    ...rest,
    ...getInputProps(schema, type, options),
  }

  const inputValue =
    inputProps.type === 'number' || inputProps.type === 'integer'
      ? value || value === 0
        ? value
        : ''
      : value == null
        ? ''
        : value

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value === '' ? options.emptyValue : event.target.value),
    [onChange, options.emptyValue],
  )
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => onBlur(id, event.target.value),
    [onBlur, id],
  )
  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => onFocus(id, event.target.value),
    [onFocus, id],
  )

  const invalid = Boolean(rawErrors && rawErrors.length > 0)

  return (
    <>
      <input
        id={id}
        name={htmlName || id}
        className={`${inputClass} ${invalid ? 'border-signal' : ''}`}
        readOnly={readonly}
        disabled={disabled}
        autoFocus={autofocus}
        value={inputValue}
        autoComplete="off"
        spellCheck={false}
        list={schema.examples ? examplesId(id) : undefined}
        onChange={onChangeOverride || handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        aria-invalid={invalid}
        aria-describedby={ariaDescribedByIds(id, !!schema.examples)}
        {...inputProps}
      />
    </>
  )
}

function TextareaWidget(props: WidgetProps) {
  const {
    id,
    htmlName,
    options,
    placeholder,
    value,
    required,
    disabled,
    readonly,
    autofocus = false,
    onChange,
    onBlur,
    onFocus,
    rawErrors,
  } = props

  return (
    <textarea
      id={id}
      name={htmlName || id}
      className={`${inputClass} min-h-32 resize-y ${rawErrors?.length ? 'border-signal' : ''}`}
      value={value || ''}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      rows={typeof options.rows === 'number' ? options.rows : 5}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) =>
        onChange(event.target.value === '' ? options.emptyValue : event.target.value)
      }
      onBlur={(event) => onBlur(id, event.target.value)}
      onFocus={(event) => onFocus(id, event.target.value)}
      aria-describedby={ariaDescribedByIds(id)}
    />
  )
}

function SelectWidget(props: WidgetProps) {
  const {
    schema,
    id,
    options,
    value,
    required,
    disabled,
    readonly,
    multiple = false,
    autofocus = false,
    onChange,
    onBlur,
    onFocus,
    placeholder,
    htmlName,
    rawErrors,
  } = props
  const { enumOptions, enumDisabled, emptyValue: optEmptyVal } = options
  const emptyValue = multiple ? [] : ''
  const optionValueFormat = getOptionValueFormat(options)
  const selectValue = enumOptionSelectedValue(
    value,
    enumOptions,
    multiple,
    optionValueFormat,
    emptyValue,
  )

  return (
    <select
      id={id}
      name={htmlName || id}
      multiple={multiple}
      className={`${inputClass} appearance-none ${rawErrors?.length ? 'border-signal' : ''}`}
      value={selectValue}
      required={required}
      disabled={disabled || readonly}
      autoFocus={autofocus}
      onChange={(event) => {
        const next = multiple
          ? Array.from(event.target.selectedOptions).map((option) => option.value)
          : event.target.value
        onChange(
          enumOptionValueDecoder(next, enumOptions, optionValueFormat, optEmptyVal),
        )
      }}
      onBlur={(event) =>
        onBlur(
          id,
          enumOptionValueDecoder(
            event.target.value,
            enumOptions,
            optionValueFormat,
            optEmptyVal,
          ),
        )
      }
      onFocus={(event) =>
        onFocus(
          id,
          enumOptionValueDecoder(
            event.target.value,
            enumOptions,
            optionValueFormat,
            optEmptyVal,
          ),
        )
      }
      aria-describedby={ariaDescribedByIds(id)}
    >
      {!multiple && schema.default === undefined ? (
        <option value="">{placeholder || 'Select…'}</option>
      ) : null}
      {Array.isArray(enumOptions)
        ? enumOptions.map(({ value: enumValue, label }, index) => (
            <option
              key={String(enumValue)}
              value={enumOptionValueEncoder(enumValue, index, optionValueFormat)}
              disabled={enumDisabled?.includes(enumValue)}
            >
              {label}
            </option>
          ))
        : null}
    </select>
  )
}

function CheckboxWidget(props: WidgetProps) {
  const {
    schema,
    uiSchema,
    options,
    id,
    value,
    disabled,
    readonly,
    label,
    hideLabel,
    autofocus = false,
    onBlur,
    onFocus,
    onChange,
    registry,
    htmlName,
  } = props
  const required = schemaRequiresTrueValue(schema)
  const uiOptions = getUiOptions(uiSchema)
  const DescriptionFieldTemplate = getTemplate(
    'DescriptionFieldTemplate',
    registry,
    options,
  )
  const description =
    uiOptions.widget === 'checkbox'
      ? undefined
      : (options.description ?? schema.description)

  return (
    <div className="flex flex-col gap-2">
      {description ? (
        <DescriptionFieldTemplate
          id={descriptionId(id)}
          description={description}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      ) : null}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-mute">
        <input
          type="checkbox"
          id={id}
          name={htmlName || id}
          checked={typeof value === 'undefined' ? false : Boolean(value)}
          required={required}
          disabled={disabled || readonly}
          autoFocus={autofocus}
          onChange={(event) => onChange(event.target.checked)}
          onBlur={(event) => onBlur(id, event.target.checked)}
          onFocus={(event) => onFocus(id, event.target.checked)}
          aria-describedby={ariaDescribedByIds(id)}
          className="h-4 w-4 accent-signal"
        />
        {labelValue(<span>{label}</span>, hideLabel)}
      </label>
    </div>
  )
}

function FieldTemplate(props: FieldTemplateProps) {
  const {
    id,
    label,
    children,
    errors,
    help,
    description,
    hidden,
    required,
    displayLabel,
    registry,
    uiSchema,
    schema,
  } = props
  const uiOptions = getUiOptions(uiSchema)
  const WrapIfAdditionalTemplate = getTemplate(
    'WrapIfAdditionalTemplate',
    registry,
    uiOptions,
  )
  const typeLabel = schemaTypeLabel(schema)

  if (hidden) {
    return <div className="hidden">{children}</div>
  }

  const isCheckbox = uiOptions.widget === 'checkbox'
  const nest = isNestSchema(schema)

  return (
    <WrapIfAdditionalTemplate {...props}>
      <div
        className="mb-4 flex min-w-0 flex-col gap-1.5"
        data-oc-nav={nest ? undefined : 'field'}
      >
        {displayLabel && !isCheckbox ? (
          <label htmlFor={id} className={`${labelClass} flex flex-wrap items-baseline gap-2`}>
            <span>{label}</span>
            {required ? (
              <span className="text-signal" aria-hidden="true">
                *
              </span>
            ) : null}
            {typeLabel ? <span className={typeClass}>{typeLabel}</span> : null}
          </label>
        ) : null}
        {displayLabel ? description : null}
        {children}
        {errors}
        {help}
      </div>
    </WrapIfAdditionalTemplate>
  )
}

function TitleFieldTemplate(props: TitleFieldProps) {
  const { id, title, required, optionalDataControl } = props
  return (
    <legend
      id={id}
      className="mb-3 flex w-full items-center justify-between px-0 text-xs text-mute"
    >
      <span>
        {title}
        {required ? (
          <span className="ml-1 text-signal" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      {optionalDataControl}
    </legend>
  )
}

function DescriptionFieldTemplate(props: DescriptionFieldProps) {
  const { id, description } = props
  if (!description) {
    return null
  }

  return (
    <div
      id={id}
      className="m-0 max-w-[60ch] text-sm leading-relaxed text-pretty text-mute"
    >
      {description}
    </div>
  )
}

function FieldErrorTemplate(props: FieldErrorProps) {
  const { errors = [], fieldPathId } = props
  if (errors.length === 0) {
    return null
  }

  return (
    <ul id={errorId(fieldPathId)} className="m-0 list-none p-0" aria-live="polite">
      {errors.filter(Boolean).map((error, index) => (
        <li key={index} className="text-sm text-signal">
          {error}
        </li>
      ))}
    </ul>
  )
}

function FieldHelpTemplate(props: FieldHelpProps) {
  const { help, fieldPathId } = props
  if (!help) {
    return null
  }

  return (
    <div
      id={`${fieldPathId.$id}__help`}
      className="text-sm text-faint"
    >
      {help}
    </div>
  )
}

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const {
    className,
    description,
    disabled,
    formData,
    fieldPathId,
    onAddProperty,
    optionalDataControl,
    properties,
    readonly,
    registry,
    required,
    schema,
    title,
    uiSchema,
  } = props
  const options = getUiOptions(uiSchema)
  const TitleField = getTemplate('TitleFieldTemplate', registry, options)
  const DescriptionField = getTemplate('DescriptionFieldTemplate', registry, options)
  const isPureUnion =
    (schema.oneOf || schema.anyOf) && !schema.properties && properties.length === 0

  if (isPureUnion) {
    return null
  }

  const { AddButton } = registry.templates.ButtonTemplates
  const showOptional = !readonly && !disabled
  const body = (
    <>
      {description ? (
        <DescriptionField
          id={descriptionId(fieldPathId)}
          description={description}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      ) : null}
      {!showOptional && !title ? optionalDataControl : null}
      {properties.map((property) => property.content)}
      {canExpand(schema, uiSchema, formData) ? (
        <AddButton
          id={buttonId(fieldPathId, 'add')}
          onClick={onAddProperty}
          disabled={disabled || readonly}
          uiSchema={uiSchema}
          registry={registry}
        />
      ) : null}
    </>
  )

  if (title && fieldPathId.path.length > 0) {
    return (
      <NavGroup
        id={fieldPathId.$id}
        title={title}
        required={required}
        extra={showOptional ? optionalDataControl : undefined}
      >
        <div className={className}>{body}</div>
      </NavGroup>
    )
  }

  return (
    <fieldset className={`${className ?? ''} min-w-0 border-0 p-0`} id={fieldPathId.$id}>
      {title ? (
        <TitleField
          id={titleId(fieldPathId)}
          title={title}
          required={required}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
          optionalDataControl={showOptional ? optionalDataControl : undefined}
        />
      ) : null}
      {body}
    </fieldset>
  )
}

function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const {
    canAdd,
    className,
    disabled,
    fieldPathId,
    uiSchema,
    items,
    optionalDataControl,
    onAddClick,
    readonly,
    registry,
    required,
    schema,
    title,
  } = props
  const uiOptions = getUiOptions(uiSchema)
  const ArrayFieldTitleTemplate = getTemplate(
    'ArrayFieldTitleTemplate',
    registry,
    uiOptions,
  )
  const ArrayFieldDescriptionTemplate = getTemplate(
    'ArrayFieldDescriptionTemplate',
    registry,
    uiOptions,
  )
  const { AddButton } = registry.templates.ButtonTemplates
  const showOptional = !readonly && !disabled
  const heading = String(uiOptions.title || title || 'List')
  const body = (
    <>
      <ArrayFieldDescriptionTemplate
        fieldPathId={fieldPathId}
        description={uiOptions.description || schema.description}
        schema={schema}
        uiSchema={uiSchema}
        registry={registry}
      />
      <div className="flex flex-col">{items}</div>
      {canAdd ? (
        <AddButton
          id={buttonId(fieldPathId, 'add')}
          onClick={onAddClick}
          disabled={disabled || readonly}
          uiSchema={uiSchema}
          registry={registry}
        />
      ) : null}
    </>
  )

  if (fieldPathId.path.length > 0) {
    return (
      <NavGroup
        id={fieldPathId.$id}
        title={heading}
        required={required}
        extra={showOptional ? optionalDataControl : undefined}
      >
        <div className={className}>{body}</div>
      </NavGroup>
    )
  }

  return (
    <fieldset className={`${className ?? ''} min-w-0 border-0 p-0`} id={fieldPathId.$id}>
      <ArrayFieldTitleTemplate
        fieldPathId={fieldPathId}
        title={heading}
        required={required}
        schema={schema}
        uiSchema={uiSchema}
        registry={registry}
        optionalDataControl={showOptional ? optionalDataControl : undefined}
      />
      {!showOptional ? optionalDataControl : null}
      {body}
    </fieldset>
  )
}

function ArrayFieldItemTemplate(props: ArrayFieldItemTemplateProps) {
  const {
    children,
    className,
    buttonsProps,
    hasToolbar,
    registry,
    uiSchema,
    index,
    itemKey,
    schema,
  } = props
  const uiOptions = getUiOptions(uiSchema)
  const ArrayFieldItemButtonsTemplate = getTemplate(
    'ArrayFieldItemButtonsTemplate',
    registry,
    uiOptions,
  )

  const body = (
    <div
      className={`${className ?? ''} flex min-w-0 flex-col gap-3 border-t border-rule py-4 md:flex-row md:items-start`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {hasToolbar ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <ArrayFieldItemButtonsTemplate {...buttonsProps} />
        </div>
      ) : null}
    </div>
  )

  if (isNestSchema(schema)) {
    return (
      <NavGroup id={`item-${itemKey}`} title={`#${index + 1}`}>
        {body}
      </NavGroup>
    )
  }

  return body
}

function WrapIfAdditionalTemplate(props: WrapIfAdditionalTemplateProps) {
  const {
    id,
    classNames,
    style,
    disabled,
    label,
    onKeyRenameBlur,
    onRemoveProperty,
    readonly,
    children,
    uiSchema,
    registry,
    schema,
  } = props
  const additional = ADDITIONAL_PROPERTY_FLAG in schema
  const { RemoveButton } = registry.templates.ButtonTemplates

  if (!additional) {
    return (
      <div className={`min-w-0 ${classNames ?? ''}`} style={style}>
        {children}
      </div>
    )
  }

  return (
    <div className={`grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12 ${classNames ?? ''}`} style={style}>
      <div className="md:col-span-4" tabIndex={-1} data-oc-nav="field">
        <label htmlFor={`${id}-key`} className={labelClass}>
          Key
        </label>
        <input
          className={`${inputClass} mt-2`}
          type="text"
          id={`${id}-key`}
          onBlur={onKeyRenameBlur}
          defaultValue={label}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="min-w-0 md:col-span-7">{children}</div>
      <div className="md:col-span-1 md:pt-8">
        <RemoveButton
          id={buttonId(id, 'remove')}
          disabled={disabled || readonly}
          onClick={onRemoveProperty}
          uiSchema={uiSchema}
          registry={registry}
        />
      </div>
    </div>
  )
}

function TextButton(props: IconButtonProps & { children: string }) {
  const {
    icon: _icon,
    iconType: _iconType,
    uiSchema: _uiSchema,
    registry: _registry,
    children,
    className: _className,
    ...rest
  } = props

  return (
    <button type="button" className={ghostButtonClass} data-oc-nav="action" {...rest}>
      {children}
    </button>
  )
}

function AddButton(props: IconButtonProps) {
  return <TextButton {...props}>Add</TextButton>
}

function RemoveButton(props: IconButtonProps) {
  return <TextButton {...props}>Remove</TextButton>
}

function MoveUpButton(props: IconButtonProps) {
  return <TextButton {...props}>Up</TextButton>
}

function MoveDownButton(props: IconButtonProps) {
  return <TextButton {...props}>Down</TextButton>
}

function CopyButton(props: IconButtonProps) {
  return <TextButton {...props}>Copy</TextButton>
}

function SubmitButton({ uiSchema }: SubmitButtonProps) {
  const { norender } = getSubmitButtonOptions(uiSchema)
  if (norender) {
    return null
  }
  return null
}

const theme: ThemeProps = {
  templates: {
    BaseInputTemplate,
    FieldTemplate,
    ObjectFieldTemplate,
    ArrayFieldTemplate,
    ArrayFieldItemTemplate,
    TitleFieldTemplate,
    DescriptionFieldTemplate,
    FieldErrorTemplate,
    FieldHelpTemplate,
    WrapIfAdditionalTemplate,
    ButtonTemplates: {
      AddButton,
      RemoveButton,
      MoveUpButton,
      MoveDownButton,
      CopyButton,
      SubmitButton,
    },
  },
  widgets: {
    SelectWidget,
    CheckboxWidget,
    TextareaWidget,
  },
}

export const SwissForm = withTheme(theme)
