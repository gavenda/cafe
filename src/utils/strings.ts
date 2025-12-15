export const isBlank = (str: string | undefined) => {
  return !str || /^\s*$/.test(str);
};

export const isNotBlank = (str: string | undefined) => !isBlank(str);
