/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

// TODO make the hardcoded theme-classic classnames configurable (or add them
// to ThemeClassNames?)

/**
 * If the anchor has no height and is just a "marker" in the DOM; we'll use the
 * parent (normally the link text) rect boundaries instead
 */
function getVisibleBoundingClientRect(element) {
  const rect = element.getBoundingClientRect();
  const hasNoHeight = rect.top === rect.bottom;
  if (hasNoHeight) {
    return getVisibleBoundingClientRect(element.parentNode);
  }
  return rect;
}

/**
 * Considering we divide viewport into 2 zones of each 50vh, this returns true
 * if an element is in the first zone (i.e., appear in viewport, near the top)
 */
function isInViewportTopHalf(boundingRect) {
  return boundingRect.top > 0 && boundingRect.bottom < window.innerHeight / 2;
}

function getAnchors({ minHeadingLevel, maxHeadingLevel }) {
  const selectors = [];
  for (let i = minHeadingLevel; i <= maxHeadingLevel; i += 1) {
    selectors.push(`h${i}.anchor`);
  }

  return Array.from(document.querySelectorAll(selectors.join()));
}

function getActiveAnchor(anchors, { anchorTopOffset }) {
  // Naming is hard: The "nextVisibleAnchor" is the first anchor that appear
  // under the viewport top boundary. It does not mean this anchor is visible
  // yet, but if user continues scrolling down, it will be the first to become
  // visible
  const nextVisibleAnchor = anchors.find((anchor) => {
    const boundingRect = getVisibleBoundingClientRect(anchor);
    return boundingRect.top >= anchorTopOffset;
  });

  if (nextVisibleAnchor) {
    const boundingRect = getVisibleBoundingClientRect(nextVisibleAnchor);
    // If anchor is in the top half of the viewport: it is the one we consider
    // "active" (unless it's too close to the top and and soon to be scrolled
    // outside viewport)
    if (isInViewportTopHalf(boundingRect)) {
      return nextVisibleAnchor;
    }
    // If anchor is in the bottom half of the viewport, or under the viewport,
    // we consider the active anchor is the previous one. This is because the
    // main text appearing in the user screen mostly belong to the previous
    // anchor. Returns null for the first anchor, see
    // https://github.com/facebook/docusaurus/issues/5318
    return anchors[anchors.indexOf(nextVisibleAnchor) - 1] ?? null;
  }
  // no anchor under viewport top? (ie we are at the bottom of the page)
  // => highlight the last anchor found
  return anchors[anchors.length - 1] ?? null;
}

function getLinkAnchorValue(link) {
  return decodeURIComponent(link.href.substring(link.href.indexOf('#') + 1));
}

function getLinks(linkClassName) {
  return Array.from(document.getElementsByClassName(linkClassName));
}

function getNavbarHeight() {
  // Not ideal to obtain actual height this way
  // Using TS ! (not ?) because otherwise a bad selector would be un-noticed
  return document.querySelector('.navbar').clientHeight;
}

function useAnchorTopOffsetRef() {
  const anchorTopOffsetRef = useRef(0);
  const hideOnScroll = false;

  useEffect(() => {
    anchorTopOffsetRef.current = hideOnScroll ? 0 : getNavbarHeight();
  }, [hideOnScroll]);

  return anchorTopOffsetRef;
}

/**
 * Side-effect that applies the active class name to the TOC heading that the
 * user is currently viewing. Disabled when `config` is undefined.
 */
export function useTOCHighlight(config) {
  const lastActiveLinkRef = useRef(undefined);

  const anchorTopOffsetRef = useAnchorTopOffsetRef();

  useEffect(() => {
    if (!config) {
      // no-op, highlighting is disabled
      return () => {};
    }

    const {
      linkClassName,
      linkActiveClassName,
      minHeadingLevel,
      maxHeadingLevel,
    } = config;

    function updateLinkActiveClass(link, active) {
      if (active) {
        if (lastActiveLinkRef.current && lastActiveLinkRef.current !== link) {
          lastActiveLinkRef.current?.classList.remove(linkActiveClassName);
        }
        link.classList.add(linkActiveClassName);
        lastActiveLinkRef.current = link;
        // link.scrollIntoView({block: 'nearest'});
      } else {
        link.classList.remove(linkActiveClassName);
      }
    }

    function updateActiveLink() {
      const links = getLinks(linkClassName);
      const anchors = getAnchors({ minHeadingLevel, maxHeadingLevel });
      const activeAnchor = getActiveAnchor(anchors, {
        anchorTopOffset: anchorTopOffsetRef.current,
      });
      const activeLink = links.find(
        (link) => activeAnchor && activeAnchor.id === getLinkAnchorValue(link),
      );

      links.forEach((link) => {
        updateLinkActiveClass(link, link === activeLink);
      });
    }

    let bod = Array.from(document.getElementsByTagName('body'))[0];

    bod.addEventListener('scroll', updateActiveLink);
    bod.addEventListener('resize', updateActiveLink);

    updateActiveLink();

    return () => {
      bod.removeEventListener('scroll', updateActiveLink);
      bod.removeEventListener('resize', updateActiveLink);
    };
  }, [config, anchorTopOffsetRef]);
}