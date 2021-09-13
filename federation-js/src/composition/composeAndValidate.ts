import { composeServices } from './compose';
import {
  validateComposedSchema,
  validateServicesBeforeComposition,
  validateServicesBeforeNormalization,
} from './validate';
import { ServiceDefinition } from './types';
import { normalizeTypeDefs } from './normalize';
import { compositionHasErrors, CompositionResult } from './utils';

export function composeAndValidate(
  serviceList: ServiceDefinition[],
): CompositionResult {
  const errors = validateServicesBeforeNormalization(serviceList);

  const normalizedServiceList = serviceList.map(({ typeDefs, ...rest }) => ({
    typeDefs: normalizeTypeDefs(typeDefs),
    ...rest
  }));

  // generate errors or warnings of the individual services
  errors.push(...validateServicesBeforeComposition(normalizedServiceList));

  // FIXME: 在这里整合 services 的 graphql，最终生成。
  // generate a schema and any errors or warnings
  const compositionResult = composeServices(normalizedServiceList);

  if (compositionHasErrors(compositionResult)) {
    errors.push(...compositionResult.errors);
  }

  // validate the composed schema based on service information
  errors.push(
    ...validateComposedSchema({
      schema: compositionResult.schema,
      serviceList,
    }),
  );

  if (errors.length > 0) {
    return {
      schema: compositionResult.schema,
      errors,
    };
  } else {
    return compositionResult;
  }
}
