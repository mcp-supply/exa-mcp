import { z } from "zod"
import axios from "axios"
import { toolRegistry, API_CONFIG } from "./config"
import {
  type ExaSearchRequest,
  type ExaSearchResponse,
  type ExaSearchResult,
} from "../types"
import { createRequestLogger } from "../utils/logger.js"

/**
 * Analyzes search results to extract key information for SEO outline generation
 * @param results Array of search results from Exa API
 * @param logger Logger instance for debugging
 * @returns Object containing analyzed data for outline generation
 */
function analyzeSearchResults(
  results: ExaSearchResult[],
  logger: ReturnType<typeof createRequestLogger>
) {
  logger.log("Analyzing search results to extract key information")

  // Extract common themes, topics, and keywords from search results
  const titles = results.map((result) => result.title)
  const contentTexts = results.map((result) => result.text)

  // Extract potential headings from titles (simplified approach)
  const potentialHeadings = new Set<string>()
  titles.forEach((title) => {
    // Split titles by common separators and add parts as potential headings
    const parts = title.split(/[:\-|–—]/).map((part) => part.trim())
    parts.forEach((part) => {
      if (part.length > 3 && part.length < 100) {
        // Filter out very short or long parts
        potentialHeadings.add(part)
      }
    })
  })

  // Extract common phrases and questions from content
  const commonPhrases = extractCommonPhrases(contentTexts)
  const questions = extractQuestions(contentTexts)

  // Extract keywords and phrases that appear frequently
  const keywordFrequency = analyzeKeywordFrequency(contentTexts)

  logger.log(
    `Extracted ${potentialHeadings.size} potential headings, ${questions.length} questions, and ${keywordFrequency.length} key phrases`
  )

  return {
    potentialHeadings: Array.from(potentialHeadings),
    commonPhrases,
    questions,
    keywordFrequency,
    rawResults: results.slice(0, 3), // Keep a few raw results for reference
  }
}

/**
 * Extracts common phrases from content texts
 * @param contentTexts Array of content texts from search results
 * @returns Array of common phrases
 */
function extractCommonPhrases(contentTexts: string[]): string[] {
  // Combine all texts and split into sentences
  const allText = contentTexts.join(" ")
  const sentences = allText.split(/[.!?]\s+/)

  // Extract meaningful phrases (simplified approach)
  const phrases = sentences
    .filter((sentence) => sentence.length > 10 && sentence.length < 100)
    .map((sentence) => sentence.trim())
    .filter((sentence) => !sentence.includes("?")) // Questions are handled separately

  // Remove duplicates and limit to 15 phrases
  return Array.from(new Set(phrases)).slice(0, 15)
}

/**
 * Extracts questions from content texts
 * @param contentTexts Array of content texts from search results
 * @returns Array of questions
 */
function extractQuestions(contentTexts: string[]): string[] {
  // Combine all texts and extract question-like sentences
  const allText = contentTexts.join(" ")
  const sentences = allText.split(/[.!?]\s+/)

  // Find sentences that look like questions
  const questionWords = ["what", "why", "how", "when", "where", "who", "which"]
  const questions = sentences
    .filter((sentence) => {
      const lowerSentence = sentence.toLowerCase()
      return (
        (sentence.includes("?") ||
          questionWords.some((word) => lowerSentence.startsWith(word))) &&
        sentence.length > 10 &&
        sentence.length < 100
      )
    })
    .map((question) => {
      // Ensure questions end with a question mark
      let formattedQuestion = question.trim()
      if (!formattedQuestion.endsWith("?")) {
        formattedQuestion += "?"
      }
      return formattedQuestion
    })

  // Remove duplicates and limit to 10 questions
  return Array.from(new Set(questions)).slice(0, 10)
}

/**
 * Analyzes keyword frequency in content texts
 * @param contentTexts Array of content texts from search results
 * @returns Array of keywords/phrases with their frequency
 */
function analyzeKeywordFrequency(
  contentTexts: string[]
): Array<{ keyword: string; frequency: number }> {
  // Combine all texts
  const allText = contentTexts.join(" ").toLowerCase()

  // Simple word frequency analysis (could be enhanced with NLP libraries)
  const words = allText.split(/\s+/)
  const wordFrequency: Record<string, number> = {}

  // Count word frequencies
  words.forEach((word) => {
    // Clean the word of punctuation
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, "")
    if (cleanWord.length > 3) {
      // Ignore very short words
      wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1
    }
  })

  // Convert to array and sort by frequency
  const sortedFrequency = Object.entries(wordFrequency)
    .map(([keyword, frequency]) => ({ keyword, frequency }))
    .sort((a, b) => b.frequency - a.frequency)

  // Return top keywords
  return sortedFrequency.slice(0, 20)
}

/**
 * Generates an SEO-optimized outline based on the analyzed data
 * @param topic Main topic for the outline
 * @param keyInsights Analyzed data from search results
 * @param keywords Array of keywords to include in the outline
 * @param logger Logger instance for debugging
 * @returns Formatted SEO outline as a markdown string
 */
function generateSEOOutline(
  topic: string,
  keyInsights: ReturnType<typeof analyzeSearchResults>,
  keywords: string[],
  logger: ReturnType<typeof createRequestLogger>
): string {
  logger.log("Generating SEO outline from analyzed data")

  // Create title and introduction
  const title = `# Comprehensive SEO Content Outline: ${topic}`

  // Use provided keywords if available, otherwise use keywords from frequency analysis
  const targetKeywords =
    keywords.length > 0
      ? keywords
      : keyInsights.keywordFrequency.slice(0, 5).map((k) => k.keyword)

  // Create the keywords section
  const keywordsSection = [
    "## Target Keywords",
    "",
    ...targetKeywords.map((keyword) => `- ${keyword}`),
    "",
  ].join("\n")

  // Create the introduction section
  const introductionSection = [
    "## Introduction",
    "",
    `- Brief overview of ${topic}`,
    `- Why ${topic} is important/relevant`,
    `- What readers will learn from this content`,
    "",
  ].join("\n")

  // Create main content sections using potential headings and common phrases
  const mainSections: string[] = []

  // Use the most relevant potential headings as section titles
  const sectionHeadings = keyInsights.potentialHeadings.slice(0, 5)

  sectionHeadings.forEach((heading, index) => {
    // Create a section with the heading
    const sectionContent = [`## ${heading}`, ""]

    // Add 3-5 bullet points for each section
    const relevantPhrases = keyInsights.commonPhrases
      .slice(index * 3, index * 3 + 3)
      .map((phrase) => `- ${phrase}`)

    sectionContent.push(...relevantPhrases, "")
    mainSections.push(sectionContent.join("\n"))
  })

  // Create a FAQ section using extracted questions
  const faqSection = ["## Frequently Asked Questions", ""]

  keyInsights.questions.slice(0, 5).forEach((question) => {
    faqSection.push(
      `### ${question}`,
      "",
      `- Answer to address: ${question}`,
      ""
    )
  })

  // Create a conclusion section
  const conclusionSection = [
    "## Conclusion",
    "",
    `- Summary of key points about ${topic}`,
    `- Final thoughts on ${topic}`,
    `- Call to action or next steps`,
    "",
  ].join("\n")

  // Combine all sections into the final outline
  const outline = [
    title,
    "",
    // keywordsSection,
    introductionSection,
    ...mainSections,
    // faqSection.join("\n"),
    conclusionSection,
    "",
    "---",
    "",
    `*This SEO outline was generated for the topic: "${topic}"*`,
  ].join("\n")

  return outline
}

// Register the SEO outline generator tool
toolRegistry["seo_outline_generator"] = {
  name: "seo_outline_generator",
  description:
    "You are an expert SEO content strategist. Given a keyword or topic, generate a detailed content outline optimized for search engine ranking. Include an introduction, main sections with H1 and H2 headings, and bullet points with key information or questions to address. Focus on clarity, relevance, and SEO best practices (e.g., keyword usage, user intent). Return the outline in a markdown format.",
  schema: {
    topic: z.string().describe("The topic to generate an outline for"),
    // the keywords is a string of comma separated keywords
    keywords: z
      .string()
      .optional()
      .describe("The keywords to generate an outline for"),
  },
  handler: async ({ topic, keywords = "" }, extra) => {
    // Step 1: Generate a unique request ID and initialize logger
    const requestId = `seo_outline_generator-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`
    const logger = createRequestLogger(requestId, "seo_outline_generator")

    logger.log(`Generating SEO outline for topic: ${topic}`)

    // Parse comma-separated keywords into an array
    const keywordArray = keywords
      ? keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter((k: string) => k.length > 0)
      : []

    logger.log(`Using keywords: ${keywordArray.join(", ") || "None provided"}`)

    try {
      // Step 2: Validate the API configuration
      const apiKey = process.env.EXA_API_KEY
      if (!apiKey) {
        logger.log("Error: Missing Exa API key")
        return {
          content: [
            {
              type: "text",
              text: "Error: Missing Exa API key. Please configure the API key in the settings.",
            },
          ],
        }
      }

      // Step 3: Prepare the search request
      logger.log("Preparing search request to Exa API")

      // Create a more comprehensive query using the topic and keywords
      const searchQuery =
        keywordArray.length > 0 ? `${topic} ${keywordArray.join(" ")}` : topic

      logger.log(`Search query: ${searchQuery}`)

      const searchRequest: ExaSearchRequest = {
        query: searchQuery,
        type: "auto",
        numResults: 5, // Get results for analysis
        contents: {
          text: {
            maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS,
          },
        },
      }

      // Step 4: Send the search request to Exa API
      logger.log("Sending request to Exa API")
      const response = await axios.post<ExaSearchResponse>(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`,
        searchRequest,
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      )
      logger.log("Received response from Exa API")

      // Step 5: Validate the search results
      if (
        !response.data ||
        !response.data.results ||
        response.data.results.length === 0
      ) {
        logger.log("Warning: Empty or invalid response from Exa API")
        return {
          content: [
            {
              type: "text",
              text: "Unable to generate an SEO outline. No search results were found for the given topic.",
            },
            {
              type: "text",
              text: "Please try a different topic or check your API configuration.",
            },
          ],
        }
      }

      // Step 6: Analyze the search results to extract key information
      const searchResults = response.data.results
      const keyInsights = analyzeSearchResults(searchResults, logger)

      // Step 7: Generate the SEO outline based on the analysis
      const outline = generateSEOOutline(
        topic,
        keyInsights,
        keywordArray,
        logger
      )

      logger.log("Successfully generated SEO outline")
      logger.complete()

      // Step 8: Return the formatted outline
      return {
        content: [
          {
            type: "text",
            text: outline,
          },
        ],
      }
    } catch (error) {
      logger.log(`Error generating SEO outline: ${error}`)
      logger.complete()

      return {
        content: [
          {
            type: "text",
            text: "An error occurred while generating the SEO outline. Please try again later.",
          },
        ],
        isError: true,
      }
    }
  },
  enabled: true, // Enabled by default
}
