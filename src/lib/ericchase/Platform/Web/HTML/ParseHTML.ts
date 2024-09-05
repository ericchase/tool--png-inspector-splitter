import { HTMLElement as NodeHTMLParser_HTMLElement, parse, type Options } from 'node-html-parser';

export namespace NodeHTMLParser {
  export type HTMLElement = NodeHTMLParser_HTMLElement;
}

/**
 * @convert_tagnames_to_lowercase convert tag name to lower case (hurts performance heavily). default: `false`
 * @keep_text_content_when_parsing keep text content when parsing specific tags, default: `['noscript', 'pre', 'script', 'style']`
 * @on_comment `keep` comment tags, or `remove` them (hurts performance slightly). default: `remove`
 * @on_invalid_nested_a_tag `fix` invalid nested <a> tags, or `leave` them as is. default: `leave`
 * @on_missing_closing_tag `add` missing closing tags, or `remove` the opening tag. default: `remove`
 * @self_close_void_tags void tag serialisation, add a final slash <br/>. default: `false`
 * @void_tags case insensitive, default: `['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']`
 */
export interface HTMLParserOptions {
  convert_tagnames_to_lowercase?: boolean;
  keep_text_content_when_parsing?: string[];
  on_comment?: 'keep' | 'remove';
  on_invalid_nested_a_tag?: 'fix' | 'leave';
  on_missing_closing_tag?: 'add' | 'remove';
  self_close_void_tags?: boolean;
  void_tags?: string[];
}
export function ParseHTML(html: string, options: HTMLParserOptions = {}): NodeHTMLParser.HTMLElement {
  const _options: Partial<Options> = {
    // keep text content when parsing
    // [keep_text_content_when_parsing]
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
      pre: true,
    },
    // retrieve comments (hurts performance slightly)
    // [on_comment]
    comment: false,
    // fix invalid nested <a> HTML tags
    // [on_invalid_nested_a_tag]
    fixNestedATags: false,
    // convert tag name to lower case (hurts performance heavily)
    // [convert_tagnames_to_lowercase]
    lowerCaseTagName: false,
    // close none closed HTML tags instead of removing them (typo?)
    // [on_missing_closing_tag]
    parseNoneClosedTags: false,
    voidTag: {
      // optional and case insensitive
      // [void_tags]
      tags: ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'],
      // optional. void tag serialisation, add a final slash <br/>
      // [self_close_void_tags]
      closingSlash: false,
    },
  };

  if (options.convert_tagnames_to_lowercase === true) {
    _options.lowerCaseTagName = true;
  }
  // default
  // if (options.convert_tagnames_to_lowercase === false) {
  //   _options.lowerCaseTagName = false;
  // }
  if (options.keep_text_content_when_parsing !== undefined) {
    _options.blockTextElements = {};
    for (const tag of options.keep_text_content_when_parsing) {
      _options.blockTextElements[tag] = true;
    }
  }
  if (options.on_comment === 'keep') {
    _options.comment = true;
  }
  // default
  // if (options.on_comment === 'remove') {
  //   _options.comment = false;
  // }
  if (options.on_invalid_nested_a_tag === 'fix') {
    _options.fixNestedATags = true;
  }
  // default
  // if (options.on_invalid_nested_a_tag === 'leave') {
  //   _options.fixNestedATags = false;
  // }
  if (options.on_missing_closing_tag === 'add') {
    _options.parseNoneClosedTags = true;
  }
  // default
  // if (options.on_missing_closing_tag === 'remove') {
  //   _options.parseNoneClosedTags = false;
  // }
  if (options.self_close_void_tags === true) {
    if (_options.voidTag === undefined) {
      _options.voidTag = { closingSlash: true };
    } else {
      _options.voidTag.closingSlash = true;
    }
  }
  // default
  // if (options.self_close_void_tags === false) {
  //   if (_options.voidTag === undefined) {
  //     _options.voidTag = { closingSlash: false };
  //   } else {
  //     _options.voidTag.closingSlash = false;
  //   }
  // }
  if (options.void_tags !== undefined) {
    if (_options.voidTag === undefined) {
      _options.voidTag = { tags: options.void_tags };
    } else {
      _options.voidTag.tags = options.void_tags;
    }
  }

  return parse(html, _options);
}
