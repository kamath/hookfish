import { useCallback, useEffect, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
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
import { formGhostButtonClass, formInputClass, labelClass, typeClass } from '../lib/ui'
import { Kbd } from './hints'

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

function branchHasErrors(errorSchema: unknown, name?: string): boolean {
  if (!errorSchema || typeof errorSchema !== 'object') {
    return false
  }
  const node = name
    ? (errorSchema as Record<string, unknown>)[name]
    : errorSchema
  if (!node || typeof node !== 'object') {
    return false
  }
  const record = node as Record<string, unknown>
  if (Array.isArray(record.__errors) && record.__errors.length > 0) {
    return true
  }
  return Object.entries(record).some(
    ([key, value]) => key !== '__errors' && branchHasErrors(value),
  )
}

function optionalParamsLabel(count: number) {
  if (count < 1) {
    return null
  }
  return count === 1 ? '1 optional param' : `${count} optional params`
}

function hasDirectRequired(schema: RJSFSchema | undefined): boolean {
  return Array.isArray(schema?.required) && schema.required.length > 0
}

function NavGroup({
  id,
  title,
  required,
  extra,
  hasRequired = false,
  optionalCount = 0,
  forceOpen = false,
  forceMore = false,
  more,
  children,
}: {
  id: string
  title: string
  required?: boolean
  extra?: ReactNode
  hasRequired?: boolean
  optionalCount?: number
  forceOpen?: boolean
  forceMore?: boolean
  more?: ReactNode
  children?: ReactNode
}) {
  const pinned = Boolean(required)
  const [revealed, setRevealed] = useState(pinned || forceOpen)
  const [showMore, setShowMore] = useState(forceMore)

  useEffect(() => {
    if (forceOpen) {
      setRevealed(true)
    }
    if (forceMore) {
      setShowMore(true)
    }
  }, [forceOpen, forceMore])
  const hasMore = more != null
  const visible = pinned || revealed
  const extrasHidden = hasMore && !showMore
  const cannotCollapse = pinned || (hasRequired && revealed)
  const actionable = hasMore || !cannotCollapse

  function toggle() {
    if (cannotCollapse) {
      if (hasMore) {
        setShowMore((value) => !value)
      }
      return
    }
    if (revealed) {
      setRevealed(false)
      setShowMore(false)
      return
    }
    setRevealed(true)
    if (!hasRequired && hasMore) {
      setShowMore(true)
    }
  }

  return (
    <fieldset
      id={id}
      data-oc-nav="group"
      data-oc-collapsed={visible ? undefined : 'true'}
      className="min-w-0 border-0 p-0"
    >
      <legend className="mb-1 w-full px-0">
        <span className="flex w-full items-center gap-2">
          {actionable ? (
            <button
              type="button"
              data-oc-toggle
              aria-expanded={visible}
              className="oc-fold inline-flex min-h-8 max-w-full items-center justify-start gap-2 bg-ink/10 px-2 py-1 text-xs text-ink hover:bg-ink/15 focus-visible:bg-ink/15"
              onClick={toggle}
            >
              <span aria-hidden="true" className="font-mono text-signal">
                {visible && (showMore || !hasMore) ? '−' : '+'}
              </span>
              <span className="flex min-w-0 items-baseline">
                <span className="min-w-0 truncate">{title}</span>
              </span>
              {extrasHidden ? (
                <span className="shrink-0 text-ink/40">{optionalParamsLabel(optionalCount)}</span>
              ) : null}
            </button>
          ) : (
            <span className="oc-fold inline-flex min-h-8 max-w-full items-center justify-start gap-2 bg-ink/10 px-2 py-1 text-xs text-ink">
              <span className="flex min-w-0 items-baseline">
                <span className="min-w-0 truncate">{title}</span>
              </span>
            </span>
          )}
          {extra}
        </span>
      </legend>
      {visible ? (
        <div className="oc-nest">
          {children}
          {showMore ? more : null}
        </div>
      ) : null}
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
        className={`${formInputClass} ${invalid ? 'border-error' : ''}`}
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
      className={`${formInputClass} max-w-xl min-h-20 resize-y ${rawErrors?.length ? 'border-error' : ''}`}
      value={value || ''}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      rows={typeof options.rows === 'number' ? options.rows : 3}
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
      className={`${formInputClass} appearance-none ${rawErrors?.length ? 'border-error' : ''}`}
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
    <div className="flex min-w-0 flex-col gap-1">
      {description ? (
        <DescriptionFieldTemplate
          id={descriptionId(id)}
          description={description}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      ) : null}
      <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-mute">
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
        className={`relative mb-2 flex min-w-0 flex-col gap-1 ${nest ? '' : 'max-w-md p-2'}`}
        data-oc-nav={nest ? undefined : 'field'}
        data-oc-required={required && !nest ? 'true' : undefined}
      >
        {!nest ? (
          <span
            data-oc-field-hints
            className="oc-key-hints pointer-events-none absolute right-2 top-2 z-[1] inline-flex items-center gap-2 whitespace-nowrap text-[11px] text-mute"
          >
            <span data-oc-insert-hint className="items-center gap-1">
              <Kbd hotkey="I" />
              <span>to insert text</span>
            </span>
            <span data-oc-tab-hint className="items-center gap-1">
              <Kbd hotkey="Tab" />
              <span>to go to next input</span>
            </span>
          </span>
        ) : null}
        {displayLabel && !isCheckbox ? (
          <label htmlFor={id} className={`${labelClass} flex min-w-0 items-baseline gap-2 overflow-hidden`}>
            <span className="shrink-0">
              {label}
              {required ? (
                <span className="exec-ink" aria-hidden="true">
                  *
                </span>
              ) : null}
            </span>
            {typeLabel ? <span className={`shrink-0 ${typeClass}`}>{typeLabel}</span> : null}
            {description}
          </label>
        ) : null}
        {displayLabel && isCheckbox ? description : null}
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
      className="mb-1 flex w-full items-center justify-between px-0 text-xs text-mute"
    >
      <span>
        {title}
        {required ? (
          <span className="exec-ink" aria-hidden="true">
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
    <span
      id={id}
      className="m-0 min-w-0 flex-1 truncate text-xs text-faint"
    >
      {description}
    </span>
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
        <li key={index} className="pt-0.5 text-xs text-error">
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
      className="text-xs text-faint"
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
    errorSchema,
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
  const requiredNames = new Set(
    (Array.isArray(schema.required) ? schema.required : []).map(String),
  )
  const requiredProperties = properties.filter((property) => requiredNames.has(property.name))
  const extraProperties = properties.filter((property) => !requiredNames.has(property.name))
  const canAdd = canExpand(schema, uiSchema, formData)
  const notice = typeof options.notice === 'string' ? options.notice : undefined
  const noticeNode = notice ? (
    <p className="mb-2 text-sm text-ink">{notice}</p>
  ) : null
  const washClass = options.wash
    ? 'oc-wash mt-3 bg-ink/5 -mx-3 px-3 py-3 md:-mx-4 md:px-4'
    : ''
  const descriptionNode = description ? (
    <DescriptionField
      id={descriptionId(fieldPathId)}
      description={description}
      schema={schema}
      uiSchema={uiSchema}
      registry={registry}
    />
  ) : null
  const addNode = canAdd ? (
    <AddButton
      id={buttonId(fieldPathId, 'add')}
      onClick={onAddProperty}
      disabled={disabled || readonly}
      uiSchema={uiSchema}
      registry={registry}
    />
  ) : null

  if (options.inline === true) {
    const fields = (
      <>
        {descriptionNode}
        {properties.map((property) => property.content)}
        {addNode}
      </>
    )
    return (
      <fieldset
        className={`${className ?? ''} min-w-0 border-0 p-0 ${washClass}`}
        id={fieldPathId.$id}
      >
        {noticeNode}
        {options.nest ? <div className="oc-nest">{fields}</div> : fields}
      </fieldset>
    )
  }

  if (title && fieldPathId.path.length > 0) {
    const more =
      extraProperties.length > 0 || canAdd ? (
        <div className={className}>
          {extraProperties.map((property) => property.content)}
          {addNode}
        </div>
      ) : undefined

    return (
      <div className={`min-w-0 ${washClass}`}>
        {noticeNode}
        <NavGroup
          id={fieldPathId.$id}
          title={title}
          required={required}
          extra={showOptional ? optionalDataControl : undefined}
          hasRequired={requiredProperties.length > 0}
          optionalCount={extraProperties.length}
          forceOpen={requiredProperties.some((property) =>
            branchHasErrors(errorSchema, property.name),
          )}
          forceMore={extraProperties.some((property) =>
            branchHasErrors(errorSchema, property.name),
          )}
          more={more}
        >
          <div className={className}>
            {descriptionNode}
            {requiredProperties.map((property) => property.content)}
          </div>
        </NavGroup>
      </div>
    )
  }

  return (
    <fieldset
      className={`${className ?? ''} min-w-0 border-0 p-0 ${fieldPathId.path.length > 0 ? 'oc-nest' : ''}`}
      id={fieldPathId.$id}
    >
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
      {descriptionNode}
      {!showOptional && !title ? optionalDataControl : null}
      {properties.map((property) => property.content)}
      {addNode}
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
    errorSchema,
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
        hasRequired={Boolean(required)}
        optionalCount={items.length}
        forceOpen={branchHasErrors(errorSchema)}
        forceMore={Boolean(!required && branchHasErrors(errorSchema))}
        more={required ? undefined : <div className={className}>{body}</div>}
      >
        {required ? <div className={className}>{body}</div> : null}
      </NavGroup>
    )
  }

  return (
    <fieldset
      className={`${className ?? ''} min-w-0 border-0 p-0 ${fieldPathId.path.length > 0 ? 'oc-nest' : ''}`}
      id={fieldPathId.$id}
    >
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
      className={`${className ?? ''} flex min-w-0 flex-col gap-2 border-t border-rule py-2 md:flex-row md:items-start`}
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
    const locked = hasDirectRequired(schema)
    return (
      <NavGroup
        id={`item-${itemKey}`}
        title={`#${index + 1}`}
        hasRequired={locked}
        optionalCount={locked ? 0 : 1}
        more={locked ? undefined : body}
      >
        {locked ? body : null}
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
    <div className={`grid min-w-0 grid-cols-1 gap-2 md:grid-cols-12 ${classNames ?? ''}`} style={style}>
      <div className="p-2 md:col-span-4" tabIndex={-1} data-oc-nav="field">
        <label htmlFor={`${id}-key`} className={labelClass}>
          Key
        </label>
        <input
          className={`${formInputClass} mt-1`}
          type="text"
          id={`${id}-key`}
          onBlur={onKeyRenameBlur}
          defaultValue={label}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="min-w-0 md:col-span-7">{children}</div>
      <div className="md:col-span-1 md:pt-6">
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
    <button type="button" className={formGhostButtonClass} data-oc-nav="action" {...rest}>
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
    PasswordWidget: (props: WidgetProps) => <BaseInputTemplate {...props} type="password" />,
  },
}

const ThemedForm = withTheme(theme)

export function SwissForm(props: ComponentProps<typeof ThemedForm>) {
  return (
    <div
      className="contents"
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          !event.metaKey &&
          !event.ctrlKey &&
          event.target instanceof HTMLInputElement &&
          !['button', 'submit', 'reset'].includes(event.target.type)
        ) {
          event.preventDefault()
        }
      }}
    >
      <ThemedForm noHtml5Validate {...props} />
    </div>
  )
}
