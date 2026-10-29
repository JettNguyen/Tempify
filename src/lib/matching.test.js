import { describe, it, expect } from 'vitest'
import { artistNames, sharesArtist } from './matching.js'

describe('artistNames', () => {
  it('splits a credit into its artists', () => {
    expect(artistNames('Calvin Harris & Dua Lipa')).toEqual(['calvin harris', 'dua lipa'])
    expect(artistNames('Drake feat. Rihanna')).toEqual(['drake', 'rihanna'])
    expect(artistNames('Silk Sonic, Bruno Mars and Anderson .Paak')).toEqual(['silk sonic', 'bruno mars', 'anderson paak'])
  })

  it('ignores case, accents and a leading "the"', () => {
    expect(artistNames('The Weeknd')).toEqual(['weeknd'])
    expect(artistNames('Beyoncé')).toEqual(['beyonce'])
  })

  it('keeps names that only look like separators inside a word', () => {
    expect(artistNames('Andrew Bird')).toEqual(['andrew bird'])
    expect(artistNames('Xavier Rudd')).toEqual(['xavier rudd'])
  })

  it('has nothing for no credit', () => {
    expect(artistNames('')).toEqual([])
    expect(artistNames(undefined)).toEqual([])
  })
})

describe('sharesArtist', () => {
  it('matches a solo credit inside a joint one', () => {
    expect(sharesArtist('Calvin Harris', 'Calvin Harris & Dua Lipa')).toBe(true)
    expect(sharesArtist('Rihanna', 'Drake ft. Rihanna')).toBe(true)
  })

  it('matches the same artist written differently', () => {
    expect(sharesArtist('the weeknd', 'The Weeknd')).toBe(true)
  })

  it('does not match different artists', () => {
    expect(sharesArtist('Foster The People', 'The People')).toBe(false)
    expect(sharesArtist('Dua Lipa', 'Calvin Harris')).toBe(false)
  })
})
