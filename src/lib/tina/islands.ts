import type { QueryResult } from '@tinacms/astro/data';
import type { IslandRegistry } from '@tinacms/astro/experimental';
import type { BlogQuery, FaqsQuery, VendorsQuery } from '../../../tina/__generated__/types';
import BlogBodyIsland from '../../components/tina/BlogBodyIsland.astro';
import FaqsIsland from '../../components/tina/FaqsIsland.astro';
import VendorsIsland from '../../components/tina/VendorsIsland.astro';
import Hero from '../../components/home/Hero.astro';
import HomeCarouselIsland from '../../components/tina/HomeCarouselIsland.astro';
import HomeTestimonialsIsland from '../../components/tina/HomeTestimonialsIsland.astro';
import AboutGalleryIsland from '../../components/tina/AboutGalleryIsland.astro';
import PricingIsland from '../../components/tina/PricingIsland.astro';
import TourTimeSlotsIsland from '../../components/tina/TourTimeSlotsIsland.astro';
import {
  getBlogPost,
  getAllFaqs,
  getAllVendors,
  getHomeCarouselSlides,
  getHomepageTestimonials,
  getAboutGalleryItems,
  getPricingEntries,
  getTourTimeSlots,
} from './data';

export const islands: IslandRegistry = {
  blogBody: {
    fetch: (_request, params) => getBlogPost(params.get('slug') ?? ''),
    component: BlogBodyIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result, params) => ({
      data: (result as QueryResult<BlogQuery>).data?.blog,
      slug: params?.get('slug') ?? '',
    }),
  },
  faqsContent: {
    fetch: (request) => getAllFaqs({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: FaqsIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result) => ({
      entries: result as Array<FaqsQuery['faqs']>,
      inEditMode: true,
    }),
  },
  vendorsContent: {
    fetch: (request) => getAllVendors({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: VendorsIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result) => ({
      vendors: result as Array<VendorsQuery['vendors']>,
    }),
  },
  homeCarouselContent: {
    fetch: (request) => getHomeCarouselSlides({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: HomeCarouselIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result, params) => ({
      slides: result,
      selectedRelativePath: params?.get('entry') ?? '',
    }),
  },
  homeTestimonialsContent: {
    fetch: (request) => getHomepageTestimonials({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: HomeTestimonialsIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result, params) => ({
      testimonials: result as Array<Record<string, unknown>>,
      inEditMode: true,
      selectedRelativePath: params?.get('entry') ?? '',
    }),
  },
  aboutGalleryContent: {
    fetch: (request) => getAboutGalleryItems({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: AboutGalleryIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result) => ({
      images: result as Array<Record<string, unknown>>,
    }),
  },
  pricingContent: {
    fetch: (request) => getPricingEntries({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: PricingIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result) => ({
      entries: result as Array<Record<string, unknown>>,
    }),
  },
  tourTimeSlotsContent: {
    fetch: (request) => getTourTimeSlots({
      preview: true,
      selectedRelativePath: new URL(request.url).searchParams.get('entry'),
    }),
    component: TourTimeSlotsIsland,
    wrapper: { tag: 'div' },
    propsFromData: (result) => ({
      timeSlotOptions: result as Array<Record<string, unknown>>,
    }),
  },
};
