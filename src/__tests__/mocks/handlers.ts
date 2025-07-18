import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock Claude CLI responses
  http.post('*/api/chat/completions', () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Mock Claude response' } }]
    })
  }),
  
  // Mock Gemini API responses
  http.post('*/v1beta/models/gemini-pro:generateContent', () => {
    return HttpResponse.json({
      candidates: [{ content: { parts: [{ text: 'Mock Gemini response' }] } }]
    })
  })
]