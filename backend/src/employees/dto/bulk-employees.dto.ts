import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';
import { UpdateEmployeeDto } from './update-employee.dto';

class EmployeePatchDto {
  @IsString()
  employeeId!: string;

  @ValidateNested()
  @Type(() => UpdateEmployeeDto)
  data!: UpdateEmployeeDto;
}

export class BulkEmployeesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmployeePatchDto)
  patches!: EmployeePatchDto[];
}
