import type { CspIntegration } from '@/shared/lib/utils';

export function requireCspIntegration(
    integration: CspIntegration,
    component: string,
    enabled: readonly CspIntegration[],
): void {
    if (!enabled.includes(integration)) {
        throw new Error(
            `<${component} /> needs '${integration}' in CSP_ENABLED_INTEGRATIONS (src/shared/config/csp), otherwise CSP blocks it`,
        );
    }
}

const afterPrerender = (code: string) =>
    `(function(){var run=function(){${code}};if(document.prerendering){document.addEventListener('prerenderingchange',run,{once:true})}else{run()}})();`;

export type YandexMetrikaOptions = {
    webvisor?: boolean;
    clickmap?: boolean;
    trackLinks?: boolean;
    accurateTrackBounce?: boolean;
    ecommerce?: string | false;
};

export function yandexMetrikaSnippet(id: number, options: YandexMetrikaOptions = {}): string {
    const {
        webvisor = true,
        clickmap = true,
        trackLinks = true,
        accurateTrackBounce = true,
        ecommerce = false,
    } = options;
    const params = JSON.stringify({
        ssr: true,
        webvisor,
        clickmap,
        ecommerce: ecommerce || undefined,
        accurateTrackBounce,
        trackLinks,
    });

    return afterPrerender(
        `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${id}','ym');ym(${id},'init',${params});`,
    );
}

export function googleTagManagerSnippet(id: string): string {
    return afterPrerender(
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(id)});`,
    );
}

export function googleAnalyticsSnippet(id: string): string {
    const quoted = JSON.stringify(id);

    return afterPrerender(
        `var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(${quoted});document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config',${quoted});`,
    );
}

export function vkPixelSnippet(id: string): string {
    return afterPrerender(
        `var _tmr=window._tmr||(window._tmr=[]);_tmr.push({id:${JSON.stringify(id)},type:"pageView",start:(new Date()).getTime()});(function(d,w,id){if(d.getElementById(id))return;var ts=d.createElement("script");ts.type="text/javascript";ts.async=true;ts.id=id;ts.src="https://top-fwz1.mail.ru/js/code.js";var f=function(){var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(ts,s);};if(w.opera=="[object Opera]"){d.addEventListener("DOMContentLoaded",f,false);}else{f();}})(document,window,"tmr-code");`,
    );
}

export function calltouchSnippet(id: string): string {
    return afterPrerender(
        `(function(w,d,n,c){w.CalltouchDataObject=n;w[n]=function(){w[n]["callbacks"].push(arguments)};if(!w[n]["callbacks"]){w[n]["callbacks"]=[]}w[n]["loaded"]=false;if(typeof c!=="object"){c=[c]}w[n]["counters"]=c;for(var i=0;i<c.length;i+=1){p(c[i])}function p(cId){var a=d.getElementsByTagName("script")[0],s=d.createElement("script"),i=function(){a.parentNode.insertBefore(s,a)},m=typeof Array.prototype.find==="function",n=m?"init-min.js":"init.js";s.async=true;s.src="https://mod.calltouch.ru/"+n+"?id="+cId;if(w.opera=="[object Opera]"){d.addEventListener("DOMContentLoaded",i,false)}else{i()}}})(window,document,"ct",${JSON.stringify(id)});`,
    );
}
