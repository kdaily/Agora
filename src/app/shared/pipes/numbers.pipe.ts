import { Pipe, PipeTransform } from '@angular/core';

import { isNumber } from 'util';

@Pipe({ name: 'myNumbers' })
export class NumbersPipe implements PipeTransform {
    transform(allInputs: any[]) {
        return allInputs.filter((input) => isNumber(input));
    }
}
