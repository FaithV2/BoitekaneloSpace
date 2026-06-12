export function scanForHarmfulContent(text) {
  if (!text) {
    return { flag: false, warningMessage: null }
  }

  const normalized = text.toLowerCase()
  const markers = [
    'suicide',
    'self harm',
    'kill myself',
    'end my life',
    'i want to die',
    'cant go on',
    'hurt myself',
    'no reason to live',
    'numb',
    'never go on',
    'die alone'
  ]

  const matches = markers.filter((marker) => normalized.includes(marker))
  if (matches.length > 0) {
    return {
      flag: true,
      warningMessage: 'If you are in immediate danger or considering self-harm, please contact local emergency services or a crisis hotline right away.'
    }
  }

  return { flag: false, warningMessage: null }
}
