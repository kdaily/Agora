import {
    Component,
    OnInit,
    ViewEncapsulation,
    ViewChild,
    ElementRef,
    Input
} from '@angular/core';

import { Gene } from '../../../models';

import { ChartService } from '../../services';
import { DataService, GeneService } from '../../../core/services';

import * as d3 from 'd3';
import * as dc from 'dc';

@Component({
    selector: 'box-plot',
    templateUrl: './box-plot-view.component.html',
    styleUrls: [ './box-plot-view.component.scss' ],
    encapsulation: ViewEncapsulation.None
})
export class BoxPlotViewComponent implements OnInit {
    @Input() title: string;
    @Input() chart: any;
    @Input() info: any;
    @Input() label: string = '';
    @Input() currentGene = this.geneService.getCurrentGene();
    @Input() dim: any;
    @Input() group: any;

    @ViewChild('chart') boxPlot: ElementRef;

    changedLabels: boolean = false;
    display: boolean = false;
    counter: number = 0;
    geneEntries: Gene[] = [];
    // Define the div for the tooltip
    div: any = d3.select('body').append('div')
        .attr('class', 'bp-tooltip')
        .style('width', 200)
        .style('height', 160)
        .style('opacity', 0);

    private resizeTimer;

    constructor(
        private dataService: DataService,
        private geneService: GeneService,
        private chartService: ChartService
    ) { }

    ngOnInit() {
        this.initChart();
    }

    initChart() {
        this.geneEntries = this.dataService.getGeneEntries();
        this.info = this.chartService.getChartInfo(this.label);
        this.dim = this.dataService.getDimension(
            this.info,
            this.currentGene
        );
        this.group = this.dataService.getGroup(this.info);

        this.chart = dc.boxPlot(this.boxPlot.nativeElement);

        this.chart
            .dimension(this.dim)
            .yAxisLabel('log 2 fold change', 20)
            .group(this.group)
            .renderTitle(true)
            .showOutliers(false)
            .dataWidthPortion(0.1)
            .dataOpacity(0)
            .colors('transparent')
            .on('filtered', (chart) => {
                this.renderRedCircle(chart, true);
            })
            .tickFormat(() => '')
            .elasticY(true);

        if (this.info.attr !== 'fc') { this.chart.yAxis().tickFormat(d3.format('.1e')); }
        this.chart.xAxis().tickFormat('');

        // Remove filtering for these charts
        this.chart.filter = function() {
            //
        };
        this.chart.margins().left = 70;

        this.registerChartEvent(this.chart, 'postRedraw');
        this.registerChartEvent(this.chart, 'postRender');

        this.chart.render();
    }

    getNearestPot(num: number, multpl: number, upper?: boolean): number {
        if (num >= 1) {
            return Math.pow(multpl, Math.ceil(Math.log(num) / Math.log(multpl)));
        }
        let accum = 1;
        while (num * accum < multpl) {
            accum *= multpl;
        }
        num = Math.ceil(num * accum) / accum;

        return (upper) ? num : (num / multpl);
    }

    getYScale(): d3.ScaleContinuousNumeric<number, number> {
        const minMaxArray = this.group.all()[0].value.slice();
        const max = minMaxArray.reduce(function(a, b) {
            return Math.max(a, b);
        });
        const min = minMaxArray.reduce(function(a, b) {
            return Math.min(a, b);
        });

        // return d3.scaleLog().base(multpl).domain([min, max]);
        return d3.scaleLinear().domain([min, max]);
    }

    // A custom renderlet function for this chart, allows us to change
    // what happens to the chart after rendering
    registerChartEvent(chartEl: dc.BoxPlot, type: string = 'renderlet') {
        const self = this;
        // Using a different name for the chart variable here so it's not shadowed
        chartEl.on(type, function(chart) {
            chart.selectAll('rect.box')
                .attr('rx', 9);

            // Renders the selected gene circle
            (type === 'postRender') ? self.renderRedCircle(chart) :
                self.renderRedCircle(chart, true);
        });
    }

    renderRedCircle(chart: dc.BoxPlot, translate?: boolean) {
        const self = this;
        const lineCenter = chart.selectAll('line.center');
        const yDomainLength = Math.abs(chart.y().domain()[1] - chart.y().domain()[0]);
        const svgEl = (chart.selectAll('g.axis.y').node() as SVGGraphicsElement);
        const mult = (svgEl.getBBox().height - 10) / yDomainLength;
        // Update the component gene copy everytime
        self.currentGene = self.geneService.getCurrentGene();
        const val = +self.currentGene[self.info.attr];
        let logVal = (self.info.attr === 'fc') ? Math.log2(val) : Math.log10(val);
        logVal = this.dataService.getSignificantValue(logVal);
        const significanceText = (self.currentGene.adj_p_val <= 0.05) ? ' ' : 'not ';

        if (!translate) {
            const phrase = self.currentGene.hgnc_symbol + ' is ' + significanceText +
                'significantly differentially expressed in ' +
                self.geneService.getCurrentTissue() +
                ' with a log fold change value of ' + logVal + ' and an adjusted p-value of ' +
                self.currentGene.adj_p_val + '.';

            chart.selectAll('g.box')
                .append('circle')
                .attr('cx', lineCenter.attr('x1'))
                .attr('cy', Math.abs(chart.y().domain()[1] - logVal) * mult)
                .attr('fill', '#FCA79A')
                .style('stroke', '#F47E6C')
                .style('stroke-width', 3)
                .attr('r', 13.6)
                .attr('opacity', 1)
                .on('mouseover', function() {
                    self.div.transition()
                        .duration(200)
                        .style('opacity', .9);
                    self.div.html(phrase)
                        .style('left', (d3.event.pageX - 60) + 'px')
                        .style('top', (d3.event.pageY + 20) + 'px');
                })
                .on('mouseout', function() {
                    self.div.transition()
                        .duration(500)
                        .style('opacity', 0);
                });
        } else {
            chart.select('circle')
                .attr('cx', lineCenter.attr('x1'))
                .attr('cy', Math.abs(chart.y().domain()[1] - logVal) * mult);
        }
    }

    onResize(event?: any) {
        const self = this;

        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(function() {
            self.chart
                .width(self.boxPlot.nativeElement.parentElement.offsetWidth)
                .height(self.boxPlot.nativeElement.offsetHeight);

            if (self.chart.rescale) {
                self.chart.rescale();
            }

            // Run code here, resizing has "stopped"
            self.chart.redraw();
        }, 100);
    }
}
